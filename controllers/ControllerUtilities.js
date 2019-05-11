module.exports = class ControllerUtilities {
  static setQueryOptions(limit, offset, order, desc) {
    const options = {};

    options.limit = (!Number.isInteger(limit) || limit < 0) ? 100 : limit;
    options.offset = (!Number.isInteger(offset) || offset < 0) ? 0 : offset;
    options.order = [[]];
    options.order[0][0] = order;

    options.order[0][1] = (desc === 'true') ? 'DESC' : 'ASC';

    return options;
  }

  static flatten(param, array) {
    if (array && array.length >0) {
      const t = [];
      for (const i of array) {
        t.push(i[param]);
      }
      return (t.length === 0)? undefined : t;
    }
  }

  static setPagesFilters(query) {
    const res = {
      filters: [],
    };

    for (const i of ['locale', 'subdomain']) {
      if (query[i]) {
        res.filters.push({
          [i]: query[i],
        });
      }
    }

    const pub = query['published'];
    if (pub) {
      res.filters.push({
        published: (pub === 'true'),
      });
    }


    if (query.tag) res.tags = JSON.parse(query.tag);
    return res;
  }

};
