const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Food & Dining',
        'Transportation',
        'Shopping',
        'Utilities',
        'Entertainment',
        'Health & Fitness',
      ],
    },
    limitAmount: {
      type: Number,
      required: [true, 'Budget limit is required'],
      min: [1, 'Limit must be at least 1'],
    },
    period: {
      type: String,
      required: true,
      default: () => {
        const d = new Date();
        return d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear();
      },
    },
    // Visual metadata (from frontend constants)
    icon:    { type: String, default: 'dollar-sign' },
    color:   { type: String, default: '#14b8a6' },
    colorBg: { type: String, default: 'rgba(20,184,166,0.1)' },
  },
  { timestamps: true }
);

// One budget per category per user
budgetSchema.index({ userId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
