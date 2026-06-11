const mongoose         = require('mongoose');
const Expense          = require('../models/Expense');
const { asyncHandler } = require('../middleware/errorHandler');

// ── Helpers ────────────────────────────────────────────────────────────────────
function getMonthBounds(offset = 0) {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── GET /api/dashboard/summary ────────────────────────────────────────────────
const getSummary = asyncHandler(async (req, res) => {
  const { start, end } = getMonthBounds(0);

  const uid = new mongoose.Types.ObjectId(req.user._id)
  const [expenses, income] = await Promise.all([
    // Expenses this month (non-income, completed)
    Expense.aggregate([
      { $match: { userId: uid, date: { $gte: start, $lt: end }, status: { $ne: 'failed' }, category: { $ne: 'Income' } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    // Income this month
    Expense.aggregate([
      { $match: { userId: uid, date: { $gte: start, $lt: end }, status: { $ne: 'failed' }, category: 'Income' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const totalExpenses = expenses[0]?.total ?? 0;
  const totalIncome   = income[0]?.total   ?? 0;
  const savings       = totalIncome - totalExpenses;
  const balance       = savings; // simplification — could sum all-time

  res.json({
    success: true,
    data: {
      totalBalance:  balance,
      totalIncome:   totalIncome,
      totalExpenses: totalExpenses,
      savings:       savings,
    },
  });
});

// ── GET /api/dashboard/chart-data ─────────────────────────────────────────────
const getChartData = asyncHandler(async (req, res) => {
  // Last 6 months
  const labels   = [];
  const income   = [];
  const expenses = [];

  const uid2 = new mongoose.Types.ObjectId(req.user._id)
  for (let i = -5; i <= 0; i++) {
    const { start, end } = getMonthBounds(i);
    const monthLabel = MONTH_LABELS[start.getMonth()];
    labels.push(monthLabel);

    const [exp, inc] = await Promise.all([
      Expense.aggregate([
        { $match: { userId: uid2, date: { $gte: start, $lt: end }, status: { $ne: 'failed' }, category: { $ne: 'Income' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { userId: uid2, date: { $gte: start, $lt: end }, status: { $ne: 'failed' }, category: 'Income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    expenses.push(Math.round(exp[0]?.total ?? 0));
    income.push(Math.round(inc[0]?.total   ?? 0));
  }

  res.json({ success: true, data: { labels, income, expenses } });
});

// ── GET /api/dashboard/categories ────────────────────────────────────────────
const getCategoryData = asyncHandler(async (req, res) => {
  const { start, end } = getMonthBounds(0);

  const uid3 = new mongoose.Types.ObjectId(req.user._id)
  const agg = await Expense.aggregate([
    {
      $match: {
        userId:   uid3,
        date:     { $gte: start, $lt: end },
        status:   { $ne: 'failed' },
        category: { $ne: 'Income' },
      },
    },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
    { $sort:  { total: -1 } },
  ]);

  const colorMap = {
    'Food & Dining':   '#14b8a6',
    'Transportation':  '#6366f1',
    'Shopping':        '#0ea5e9',
    'Entertainment':   '#f59e0b',
    'Utilities':       '#8b5cf6',
    'Health & Fitness':'#22c55e',
    'Other':           '#94a3b8',
  };

  const grandTotal = agg.reduce((s, r) => s + r.total, 0);
  const data = agg.map((r) => ({
    label:   r._id,
    value:   Math.round(grandTotal > 0 ? (r.total / grandTotal) * 100 : 0),
    color:   colorMap[r._id] || '#94a3b8',
  }));

  res.json({ success: true, data });
});

// ── GET /api/dashboard/transactions ──────────────────────────────────────────
const getRecentTransactions = asyncHandler(async (req, res) => {
  const transactions = await Expense.find({ userId: req.user._id })
    .sort({ date: -1 })
    .limit(10);

  const iconMap = {
    'Food & Dining':   'food',
    'Transportation':  'transport',
    'Shopping':        'shopping',
    'Utilities':       'utilities',
    'Entertainment':   'entertainment',
    'Health & Fitness':'health',
    'Income':          'income',
    'Other':           'other',
  };

  const data = transactions.map((t) => ({
    id:       t._id.toString(),
    name:     t.description,
    category: t.category,
    date:     formatRelativeDate(t.date),
    amount:   t.category === 'Income' ? t.amount : -t.amount,
    icon:     iconMap[t.category] || 'other',
    status:   t.status,
  }));

  res.json({ success: true, data });
});

// ── Relative date helper ──────────────────────────────────────────────────────
function formatRelativeDate(date) {
  const now    = new Date();
  const d      = new Date(date);
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (diffDays === 0) return `Today, ${formatted}`;
  if (diffDays === 1) return `Yesterday, ${formatted}`;
  return formatted;
}

module.exports = { getSummary, getChartData, getCategoryData, getRecentTransactions };
