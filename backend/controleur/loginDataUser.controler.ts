//import des librairies nécessaires
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const dotenv = require("dotenv");

//import du fichier .env pour les variables d'environnement
dotenv.config();

//import des fonctions pour la connexion et la déconnexion à la base de données
const { getConnection, releaseConnection } = require("../config/database");

//import des fonctions pour les cookies
const setCookieOptionsObject = require("../utils/function/setCookieOptionsObject");

/**
 * Sign JWT accesstoken
 */
const signAccessToken = (id) => {
  const privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");
  return jwt.sign({ id }, privateKey, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    algorithm: "RS256",
  });
};

/**
 * Sign JWT refreshToken
 */
const signRefreshToken = (id) => {
  const privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");
  return jwt.sign({ id }, privateKey, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    algorithm: "RS256",
  });
};

/**
 * Login user
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Please provide email and password",
      });
    }

    // Check if user exists && password is correct
    const user = await User.findOne({
      email: email,
      password: password, // Will trigger password verification
    });

    if (!user) {
      // Either email wasn't found or password didn't match
      return res.status(401).json({
        status: "error",
        message: "Incorrect email or password",
      });
    }

    // If everything ok, send token and cookie to client
    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);
    const options = setCookieOptionsObject();
    res.cookie("tokenRefresh", refreshToken, options);
    res.status(200).json({
      status: "success",
      accessToken,
      data: user.name,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh token
 */
exports.refreshToken = async (req, res, next) => {
  const refreshToken = req.cookies.tokenRefresh;
  if (!refreshToken) {
    return res.status(401).json({
      status: "error",
      message: "No refresh token provided",
    });
  }

  const privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");

  // Check if refresh token is valid
  const decoded = jwt.verify(refreshToken, privateKey);

  // Check if user exists
  const user = await User.findById(decoded.id);

  if (!user) {
    return res.status(401).json({
      status: "error",
      message: "User not found",
    });
  }

  // Check if user changed password after the token was issued
  if (user.changedPasswordAfter(decoded.iat)) {
    return res.status(401).json({
      status: "error",
      message: "User recently changed password. Please log in again.",
    });
  }

  // Create and send new access token
  const accessToken = signAccessToken(user.id);
  res.status(200).json({
    status: "success",
    accessToken,
    data: user.name,
  });
};

/**
 * Logout user
 */
exports.logout = (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ status: "success" });
};

/**
 * Get current user
 */
exports.getCurrentUser = (req, res) => {
  res.status(200).json({
    status: "success",
    data: {
      user: req.user,
    },
  });
};

/**
 * Update password
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Check if passwords are provided
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: "error",
        message: "Please provide current and new password",
      });
    }

    // Get user from database
    const user = await User.findById(req.user.id);

    // Check if current password is correct
    const isPasswordCorrect = await user.correctPassword(
      currentPassword,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        status: "error",
        message: "Your current password is incorrect",
      });
    }

    // Update password in database
    let connection;
    try {
      connection = await getConnection();

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update the password in the database
      await connection.execute(
        "UPDATE users SET password = ?, passwordChangedAt = ? WHERE id = ?",
        [hashedPassword, new Date(), user.id]
      );

      // Create and send new token
      createSendToken(user, 200, res);
    } catch (error) {
      throw error;
    } finally {
      releaseConnection(connection);
    }
  } catch (error) {
    next(error);
  }
};


