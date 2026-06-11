const Expense          = require('../models/Expense');
const { asyncHandler } = require('../middleware/errorHandler');

// ── GET /api/expenses ─────────────────────────────────────────────────────────
const getExpenses = asyncHandler(async (req, res) => {
  const { category, status, search, page = 1, limit = 100 } = req.query;

  const filter = { userId: req.user._id };
  if (category && category !== 'All') filter.category = category;
  if (status   && status   !== 'All') filter.status   = status;
  if (search) {
    filter.$or = [
      { description: { $regex: search, $options: 'i' } },
      { category:    { $regex: search, $options: 'i' } },
    ];
  }

  const skip  = (Number(page) - 1) * Number(limit);
  const [expenses, total] = await Promise.all([
    Expense.find(filter).sort({ date: -1 }).skip(skip).limit(Number(limit)),
    Expense.countDocuments(filter),
  ]);

  // Format dates as YYYY-MM-DD strings for frontend
  const formatted = expenses.map(formatExpense);

  res.json({ success: true, data: formatted, total });
});

// ── POST /api/expenses ────────────────────────────────────────────────────────
const createExpense = asyncHandler(async (req, res) => {
  const { description, category, amount, date, paymentMethod, status } = req.body;

  const expense = await Expense.create({
    userId: req.user._id,
    description,
    category,
    amount: parseFloat(amount),
    date:   new Date(date),
    paymentMethod,
    status,
  });

  res.status(201).json({ success: true, data: formatExpense(expense) });
});

// ── PUT /api/expenses/:id ─────────────────────────────────────────────────────
const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id });
  if (!expense) {
    return res.status(404).json({ success: false, message: 'Expense not found.' });
  }

  const { description, category, amount, date, paymentMethod, status } = req.body;
  if (description)   expense.description   = description;
  if (category)      expense.category      = category;
  if (amount)        expense.amount        = parseFloat(amount);
  if (date)          expense.date          = new Date(date);
  if (paymentMethod) expense.paymentMethod = paymentMethod;
  if (status)        expense.status        = status;

  await expense.save();
  res.json({ success: true, data: formatExpense(expense) });
});

// ── DELETE /api/expenses/:id ──────────────────────────────────────────────────
const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!expense) {
    return res.status(404).json({ success: false, message: 'Expense not found.' });
  }
  res.json({ success: true, message: 'Expense deleted.' });
});

// ── Helper: serialize expense for frontend ────────────────────────────────────
function formatExpense(e) {
  const obj = e.toObject ? e.toObject() : e;
  return {
    id:            obj._id.toString(),
    description:   obj.description,
    category:      obj.category,
    amount:        obj.amount,
    date:          obj.date ? new Date(obj.date).toISOString().split('T')[0] : '',
    paymentMethod: obj.paymentMethod,
    status:        obj.status,
    createdAt:     obj.createdAt,
  };
}

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
