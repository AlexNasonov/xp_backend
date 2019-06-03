const Redirect = require('../modules/sequelize').Redirect;

module.exports = class RedirectController {
  static async find(old, locale, subdomain) {
    return await Redirect.findOne({where: {
      old: old,
      locale: locale,
      subdomain: subdomain,
    },
    });
  }

  static async set(old, target, locale, subdomain) {
    if (!old) throw new Error({message: 'No initial URL provided'});
    let item = await RedirectController.find(old, locale, subdomain);
    if (item) item = await item.update({new: target});
    else {
      item = await Redirect.create({
        old: old,
        new: target,
        locale: locale,
        subdomain: subdomain,
      });
    }
    return item;
  }

  static async remove(old, locale, subdomain) {
    const item = await RedirectController.find(old, locale, subdomain);
    return (!item) ? Promise.resolve() : await item.destroy();
  }
};
