/**
 * route middleware to make basic checks
 */

exports.Regular = function(req, res, next) {
  // if user is authenticated in the session, carry on
  if (req.isAuthenticated()) {
    return next();
  }

  // if they aren't redirect them to the home data
  else res.status(401).send();
};

exports.Editor = function(req, res, next) {
  // if user is authenticated in the session and has Admin rights, carry on
  if (req.isAuthenticated() && ['admin', 'editor'].indexOf(req.user.role) !== -1) return next();
  else res.status(403).send();
};

exports.Admin = function(req, res, next) {
  // if user is authenticated in the session and has Admin rights, carry on
  if (req.isAuthenticated() && req.user.role === 'admin') return next();
  else res.status(403).send();
};
