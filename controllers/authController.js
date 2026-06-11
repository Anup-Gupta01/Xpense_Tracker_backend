const User              = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { asyncHandler }  = require('../middleware/errorHandler');

// ── POST /api/auth/register ───────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already registered.' });
  }

  const user  = await User.create({ name, email, password });
  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    token,
    user: {
      _id:         user._id,
      name:        user.name,
      email:       user.email,
      preferences: user.preferences,
      createdAt:   user.createdAt,
    },
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const token = generateToken(user._id);

  res.json({
    success: true,
    token,
    user: {
      _id:         user._id,
      name:        user.name,
      email:       user.email,
      phone:       user.phone,
      preferences: user.preferences,
      createdAt:   user.createdAt,
    },
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, phone, preferences } = req.body;

  // Check if email is taken by another user
  if (email && email !== req.user.email) {
    const taken = await User.findOne({ email });
    if (taken) {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }
  }

  const updates = {};
  if (name)        updates.name  = name;
  if (email)       updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (preferences) updates.preferences = { ...req.user.preferences.toObject(), ...preferences };

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ success: true, user });
});

// ── PUT /api/auth/password ────────────────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully.' });
});

// ── DELETE /api/auth/me ───────────────────────────────────────────────────────
const deleteAccount = asyncHandler(async (req, res) => {
  const Expense = require('../models/Expense');
  const Budget  = require('../models/Budget');

  await Promise.all([
    Expense.deleteMany({ userId: req.user._id }),
    Budget.deleteMany({ userId: req.user._id }),
    User.findByIdAndDelete(req.user._id),
  ]);

  res.json({ success: true, message: 'Account deleted.' });
});

module.exports = { register, login, getMe, updateProfile, changePassword, deleteAccount };
