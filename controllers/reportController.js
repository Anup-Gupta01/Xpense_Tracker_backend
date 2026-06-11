const mongoose         = require('mongoose');
const Expense          = require('../models/Expense');
const { asyncHandler } = require('../middleware/errorHandler');

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getMonthBounds(offset = 0) {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

// ── GET /api/reports?period=last6months ───────────────────────────────────────
const getReportData = asyncHandler(async (req, res) => {
  const { period = 'last6months' } = req.query;

  // Determine how many months back to fetch
  const monthsMap = {
    lastmonth:    1,
    last3months:  3,
    last6months:  6,
    thisyear:     new Date().getMonth() + 1,
  };
  const key    = period.toLowerCase().replace(/[\s-]/g, '');
  const months = monthsMap[key] || 6;

  // ── Monthly bar chart data ─────────────────────────────────────────────────
  const labels    = [];
  const incomeArr = [];
  const expArr    = [];
  const savArr    = [];

  const uid = new mongoose.Types.ObjectId(req.user._id);

  for (let i = -(months - 1); i <= 0; i++) {
    const { start, end } = getMonthBounds(i);
    labels.push(MONTH_LABELS[start.getMonth()]);

    const [expAgg, incAgg] = await Promise.all([
      Expense.aggregate([
        { $match: { userId: uid, date: { $gte: start, $lt: end }, status: { $ne: 'failed' }, category: { $ne: 'Income' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { userId: uid, date: { $gte: start, $lt: end }, status: { $ne: 'failed' }, category: 'Income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);
    const exp = Math.round(expAgg[0]?.total ?? 0);
    const inc = Math.round(incAgg[0]?.total ?? 0);
    expArr.push(exp);
    incomeArr.push(inc);
    savArr.push(Math.max(0, inc - exp));
  }

  // ── Category breakdown (whole period) ─────────────────────────────────────
  const periodStart = getMonthBounds(-(months - 1)).start;
  const periodEnd   = getMonthBounds(0).end;

  const catAgg = await Expense.aggregate([
    {
      $match: {
        userId:   uid,
        date:     { $gte: periodStart, $lt: periodEnd },
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
  const grandTotal = catAgg.reduce((s, r) => s + r.total, 0);
  const categoryBreakdown = catAgg.map((r) => ({
    label:   r._id,
    value:   Math.round(r.total),
    percent: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
    color:   colorMap[r._id] || '#94a3b8',
  }));

  // ── Weekly trend (current month vs last month) ─────────────────────────────
  const weeklyLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const thisMonth    = await buildWeeklyData(uid, 0);
  const lastMonth    = await buildWeeklyData(uid, -1);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalSpent     = expArr.reduce((a, b) => a + b, 0);
  const totalIncome    = incomeArr.reduce((a, b) => a + b, 0);
  const netSavings     = savArr.reduce((a, b) => a + b, 0);
  const avgMonthly     = months > 0 ? Math.round(totalSpent / months) : 0;
  const highestCatObj  = categoryBreakdown[0];
  const savingsRate    = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : '0.0';

  res.json({
    success: true,
    data: {
      monthlySpending: { labels, income: incomeArr, expenses: expArr, savings: savArr },
      categoryBreakdown,
      weeklyTrend: { labels: weeklyLabels, thisMonth, lastMonth },
      stats: {
        totalSpent:      `$${totalSpent.toLocaleString()}`,
        highestCategory: highestCatObj?.label ?? 'N/A',
        avgMonthly:      `$${avgMonthly.toLocaleString()}`,
        savingsRate:     `${savingsRate}%`,
      },
      summary: {
        totalSpending: totalSpent,
        totalIncome:   totalIncome,
        netSavings,
        savingsRate:   parseFloat(savingsRate),
      },
    },
  });
});

async function buildWeeklyData(userId, monthOffset) {
  const { start } = getMonthBounds(monthOffset);
  const result = [];
  const uid = userId instanceof mongoose.Types.ObjectId
    ? userId
    : new mongoose.Types.ObjectId(userId);

  for (let week = 0; week < 4; week++) {
    const weekStart = new Date(start.getFullYear(), start.getMonth(), 1 + week * 7);
    const weekEnd   = new Date(start.getFullYear(), start.getMonth(), 1 + (week + 1) * 7);
    const agg = await Expense.aggregate([
      {
        $match: {
          userId: uid,
          date:     { $gte: weekStart, $lt: weekEnd },
          status:   { $ne: 'failed' },
          category: { $ne: 'Income' },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    result.push(Math.round(agg[0]?.total ?? 0));
  }
  return result;
}

module.exports = { getReportData };
