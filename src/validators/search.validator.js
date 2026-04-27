const { query } = require("express-validator");

const searchValidation = [
  query("q")
    .exists()
    .withMessage("q (search query) is required")
    .isString()
    .withMessage("q must be a string")
    .isLength({ min: 2, max: 100 })
    .withMessage("q must be between 2 and 100 characters"),
];

module.exports = { searchValidation };
