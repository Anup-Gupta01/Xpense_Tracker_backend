const mongoose = require('mongoose');
const bcrypt    = require('bcryptjs');

const preferencesSchema = new mongoose.Schema({
  theme:      { type: String, enum: ['light', 'dark'], default: 'light' },
  currency:   { type: String, default: 'USD - US Dollar' },
  dateFormat: { type: String, default: 'MM/DD/YYYY' },
  language:   { type: String, default: 'English (US)' },
  notifications: {
    email:               { type: Boolean, default: true },
    push:                { type: Boolean, default: true },
    budgetAlerts:        { type: Boolean, default: true },
    weeklyReport:        { type: Boolean, default: false },
    transactionUpdates:  { type: Boolean, default: true },
  },
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name:        { type: String, required: [true, 'Name is required'], trim: true, maxlength: 100 },
    email:       { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    password:    { type: String, required: [true, 'Password is required'], minlength: 8, select: false },
    phone:       { type: String, default: '' },
    preferences: { type: preferencesSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// ── Hash password before save ─────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method: compare passwords ───────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Remove sensitive fields from JSON output ──────────────────────────────────
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
