const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Facebook Page Schema
const pageSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  pageId: { type: String, required: true, unique: true },
  pageName: { type: String, required: true },
  accessToken: { type: String, required: true },
  tokenExpiry: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Page = mongoose.model('Page', pageSchema);

// User Schema
const userSchema = new mongoose.Schema({
  facebookId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String },
  accessToken: { type: String, required: true },
  tokenExpiry: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Utility function to check token expiry
const isTokenExpired = (expiryDate) => {
  return new Date() > new Date(expiryDate);
};

// API Routes

// Login with Facebook
app.post('/api/auth/facebook', async (req, res) => {
  try {
    const { accessToken, userID } = req.body;
    
    // Verify token with Facebook
    const response = await axios.get(`https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email`);
    const userData = response.data;
    
    // Get token info for expiry
    const tokenInfo = await axios.get(`https://graph.facebook.com/oauth/access_token_info?access_token=${accessToken}`);
    const expiryDate = new Date(Date.now() + (tokenInfo.data.expires_in * 1000));
    
    // Save or update user
    const user = await User.findOneAndUpdate(
      { facebookId: userData.id },
      {
        facebookId: userData.id,
        name: userData.name,
        email: userData.email,
        accessToken: accessToken,
        tokenExpiry: expiryDate
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, user: { id: user._id, name: user.name, facebookId: user.facebookId } });
  } catch (error) {
    console.error('Facebook auth error:', error);
    res.status(401).json({ success: false, error: 'Invalid Facebook token' });
  }
});

// Get user's pages
app.get('/api/pages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get pages from Facebook API
    const response = await axios.get(`https://graph.facebook.com/me/accounts?access_token=${user.accessToken}`);
    const fbPages = response.data.data;
    
    // Update or create pages in database
    const pages = [];
    for (const fbPage of fbPages) {
      const tokenInfo = await axios.get(`https://graph.facebook.com/oauth/access_token_info?access_token=${fbPage.access_token}`);
      const expiryDate = new Date(Date.now() + (tokenInfo.data.expires_in * 1000));
      
      const page = await Page.findOneAndUpdate(
        { pageId: fbPage.id },
        {
          userId: userId,
          pageId: fbPage.id,
          pageName: fbPage.name,
          accessToken: fbPage.access_token,
          tokenExpiry: expiryDate,
          isActive: !isTokenExpired(expiryDate),
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      pages.push({
        id: page._id,
        pageId: page.pageId,
        pageName: page.pageName,
        tokenExpiry: page.tokenExpiry,
        isActive: page.isActive,
        isExpired: isTokenExpired(page.tokenExpiry)
      });
    }
    
    res.json({ pages });
  } catch (error) {
    console.error('Get pages error:', error);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

// Renew page token
app.post('/api/pages/:pageId/renew-token', async (req, res) => {
  try {
    const { pageId } = req.params;
    const { userId } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get fresh page token from Facebook
    const response = await axios.get(`https://graph.facebook.com/me/accounts?access_token=${user.accessToken}`);
    const fbPages = response.data.data;
    
    const fbPage = fbPages.find(p => p.id === pageId);
    if (!fbPage) {
      return res.status(404).json({ error: 'Page not found in Facebook account' });
    }
    
    // Get token expiry info
    const tokenInfo = await axios.get(`https://graph.facebook.com/oauth/access_token_info?access_token=${fbPage.access_token}`);
    const expiryDate = new Date(Date.now() + (tokenInfo.data.expires_in * 1000));
    
    // Update page in database
    const page = await Page.findOneAndUpdate(
      { pageId: pageId },
      {
        accessToken: fbPage.access_token,
        tokenExpiry: expiryDate,
        isActive: !isTokenExpired(expiryDate),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    res.json({ 
      success: true, 
      page: {
        id: page._id,
        pageId: page.pageId,
        pageName: page.pageName,
        tokenExpiry: page.tokenExpiry,
        isActive: page.isActive,
        isExpired: isTokenExpired(page.tokenExpiry)
      }
    });
  } catch (error) {
    console.error('Renew token error:', error);
    res.status(500).json({ error: 'Failed to renew token' });
  }
});

// Delete page
app.delete('/api/pages/:pageId', async (req, res) => {
  try {
    const { pageId } = req.params;
    await Page.findOneAndDelete({ pageId: pageId });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete page error:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

// Check token status for all pages (cron job endpoint)
app.post('/api/check-token-status', async (req, res) => {
  try {
    const pages = await Page.find({});
    
    for (const page of pages) {
      const isExpired = isTokenExpired(page.tokenExpiry);
      if (page.isActive !== !isExpired) {
        await Page.findByIdAndUpdate(page._id, { isActive: !isExpired });
      }
    }
    
    res.json({ success: true, message: 'Token status updated' });
  } catch (error) {
    console.error('Check token status error:', error);
    res.status(500).json({ error: 'Failed to check token status' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});