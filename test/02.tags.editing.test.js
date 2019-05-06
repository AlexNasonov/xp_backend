process.env.TEST_ENV = true; // disable server's sequelize.sync
process.env.NODE_ENV = 'development'; //

const models = require('../modules/sequelize');
const chai = require('chai');
const server = require('../index');
const chaiHttp = require('chai-http');
const config = require('../modules/config');

const email = config.get('admin');
const password = '123123123';
const tags = ['a_tag1', 'd_tag2', 'ec_tag3', 'b_tag4', 'c_tag5'];

const expect = chai.expect;

chai.use(chaiHttp);

describe('Tags editing', () => {
  let agent;

  before(async () => {
    agent = chai.request.agent(server);
    await models.sequelize.sync({
      force: true,
    });
    await agent.post('/api/entrance/signup').send({
      email: email,
      password: password,
    });
    await agent.post('/api/entrance/signin').send({
      email: email,
      password: password,
    });
  });

  after(async ()=> {
    await agent.post('/api/entrance/signout').send();
  });

  for (const i of tags) {
    it('create tag ' + i, async () => {
      const res = await agent.get('/api/editor/chunks/tags/' + i + '?description="some description"').send();
      expect(res).to.have.status(200);
      expect(res.body.id).to.equal(i);
    });
  }

  /**
   * TEST TAGS
   */

  it('load tags list', async () => {
    const res = await agent.get('/api/editor/chunks/tags?limit=3&offset=1&order=id&desc=true').send();
    expect(res).to.have.status(200);
    expect(res.body.rows[0].id).to.equal(tags[2]);
    expect(res.body.rows[1].id).to.equal(tags[1]);
    expect(res.body.rows[2].id).to.equal(tags[4]);
    expect(res.body.rows[3].id).to.equal(tags[3]);
    expect(res.body.rows[4].id).to.equal(tags[0]);
  });

  it('find a tag by "c_"', async () => {
    const res = await agent.get('/api/editor/chunks/tags?filterEntriesByID=c_&order=id&desc=true').send();
    expect(res).to.have.status(200);
    expect(res.body.rows[0].id).to.equal(tags[2]);
    expect(res.body.rows[1].id).to.equal(tags[4]);
  });

  it('delete a tag', async () => {
    const res = await agent.delete('/api/editor/chunks/tags/' + tags[2]).send();
    expect(res).to.have.status(200);
  });

  it('check complete list of tags after delete', async () => {
    const res = await agent.get('/api/editor/chunks/tags?order=id&desc=true').send();
    expect(res).to.have.status(200);
    expect(res.body.count).to.equal(4);
  });
});
