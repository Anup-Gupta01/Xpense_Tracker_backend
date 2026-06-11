const express = require('express');
const router  = express.Router();

const { getSummary, getChartData, getCategoryData, getRecentTransactions } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.get('/summary',      protect, getSummary);
router.get('/chart-data',   protect, getChartData);
router.get('/categories',   protect, getCategoryData);
router.get('/transactions', protect, getRecentTransactions);

module.exports = router;
