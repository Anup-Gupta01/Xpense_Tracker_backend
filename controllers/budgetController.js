const mongoose         = require('mongoose');
const Budget           = require('../models/Budget');
const Expense          = require('../models/Expense');
const { asyncHandler } = require('../middleware/errorHandler');

// ── Category metadata map ─────────────────────────────────────────────────────
const CATEGORY_META = {
  'Food & Dining':   { icon: 'utensils',     color: '#14b8a6', colorBg: 'rgba(20,184,166,0.1)' },
  'Transportation':  { icon: 'car',          color: '#6366f1', colorBg: 'rgba(99,102,241,0.1)' },
  'Shopping':        { icon: 'shopping-bag', color: '#0ea5e9', colorBg: 'rgba(14,165,233,0.1)' },
  'Utilities':       { icon: 'zap',          color: '#8b5cf6', colorBg: 'rgba(139,92,246,0.1)' },
  'Entertainment':   { icon: 'tv',           color: '#f59e0b', colorBg: 'rgba(245,158,11,0.1)' },
  'Health & Fitness':{ icon: 'heart',        color: '#22c55e', colorBg: 'rgba(34,197,94,0.1)'  },
};

// ── Aggregate spent per category for the current month ─────────────────────────
async function getSpentByCategory(userId, period) {
  // Parse period like "Jun 2026"
  const parts  = period.split(' ');
  const month  = parts[0];
  const year   = parseInt(parts[1], 10);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthIndex = months.indexOf(month);

  let startDate, endDate;
  if (monthIndex !== -1 && !isNaN(year)) {
    startDate = new Date(year, monthIndex, 1);
    endDate   = new Date(year, monthIndex + 1, 1);
  } else {
    // fallback: current month
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  // Cast to ObjectId for aggregation pipeline
  const uid = new mongoose.Types.ObjectId(userId);

  const agg = await Expense.aggregate([
    {
      $match: {
        userId:  uid,
        date:    { $gte: startDate, $lt: endDate },
        status:  { $ne: 'failed' },
        category: { $ne: 'Income' },
      },
    },
    {
      $group: {
        _id:          '$category',
        totalSpent:   { $sum: '$amount' },
        transactions: { $sum: 1 },
      },
    },
  ]);

  const map = {};
  agg.forEach((r) => { map[r._id] = { spent: r.totalSpent, transactions: r.transactions }; });
  return map;
}

// ── GET /api/budgets ──────────────────────────────────────────────────────────
const getBudgets = asyncHandler(async (req, res) => {
  const budgets = await Budget.find({ userId: req.user._id }).sort({ createdAt: 1 });

  if (budgets.length === 0) {
    return res.json({ success: true, data: [] });
  }

  // We'll group by period — use first budget's period as reference (all should match)
  const period = budgets[0].period;
  const spentMap = await getSpentByCategory(req.user._id, period);

  const data = budgets.map((b) => {
    const { spent = 0, transactions = 0 } = spentMap[b.category] || {};
    return {
      id:           b._id.toString(),
      category:     b.category,
      limit:        b.limitAmount,
      spent:        spent,
      remaining:    b.limitAmount - spent,
      transactions: transactions,
      period:       b.period,
      icon:         b.icon,
      color:        b.color,
      colorBg:      b.colorBg,
    };
  });

  res.json({ success: true, data });
});

// ── POST /api/budgets ─────────────────────────────────────────────────────────
const createBudget = asyncHandler(async (req, res) => {
  const { category, limitAmount, period } = req.body;

  // Check for duplicate
  const existing = await Budget.findOne({ userId: req.user._id, category });
  if (existing) {
    return res.status(409).json({ success: false, message: `Budget for ${category} already exists.` });
  }

  const meta   = CATEGORY_META[category] || { icon: 'dollar-sign', color: '#14b8a6', colorBg: 'rgba(20,184,166,0.1)' };
  const budget = await Budget.create({
    userId:      req.user._id,
    category,
    limitAmount: parseFloat(limitAmount),
    period,
    ...meta,
  });

  // Return with live spent
  const spentMap = await getSpentByCategory(req.user._id, budget.period);
  const { spent = 0, transactions = 0 } = spentMap[category] || {};

  res.status(201).json({
    success: true,
    data: {
      id:           budget._id.toString(),
      category:     budget.category,
      limit:        budget.limitAmount,
      spent,
      remaining:    budget.limitAmount - spent,
      transactions,
      period:       budget.period,
      icon:         budget.icon,
      color:        budget.color,
      colorBg:      budget.colorBg,
    },
  });
});

// ── PUT /api/budgets/:id ──────────────────────────────────────────────────────
const updateBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.params.id, userId: req.user._id });
  if (!budget) {
    return res.status(404).json({ success: false, message: 'Budget not found.' });
  }

  const { limitAmount, period } = req.body;
  if (limitAmount) budget.limitAmount = parseFloat(limitAmount);
  if (period)      budget.period      = period;

  await budget.save();

  const spentMap = await getSpentByCategory(req.user._id, budget.period);
  const { spent = 0, transactions = 0 } = spentMap[budget.category] || {};

  res.json({
    success: true,
    data: {
      id:           budget._id.toString(),
      category:     budget.category,
      limit:        budget.limitAmount,
      spent,
      remaining:    budget.limitAmount - spent,
      transactions,
      period:       budget.period,
      icon:         budget.icon,
      color:        budget.color,
      colorBg:      budget.colorBg,
    },
  });
});

// ── DELETE /api/budgets/:id ───────────────────────────────────────────────────
const deleteBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!budget) {
    return res.status(404).json({ success: false, message: 'Budget not found.' });
  }
  res.json({ success: true, message: 'Budget deleted.' });
});

module.exports = { getBudgets, createBudget, updateBudget, deleteBudget };
