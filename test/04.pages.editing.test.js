process.env.TEST_ENV = true; // disable server's sequelize.sync
process.env.NODE_ENV = 'development'; //

const models = require('../modules/sequelize');
const chai = require('chai');
const server = require('../index');
const chaiHttp = require('chai-http');
const config = require('../modules/config');

const email = config.get('admin');
const password = '123123123';
const tags = ['a_p_tag1', 'd_p_tag2', 'ec_p_tag3', 'b_p_tag4', 'c_p_tag5'];


const expect = chai.expect;

chai.use(chaiHttp);

describe('Pages editing', () => {
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

  after(async () => {
    await agent.post('/api/entrance/signout').send();
  });

  for (const i of tags) {
    it('create tag '+i, async () => {
      const res = await agent.get('/api/editor/pages/tags/'+i+'?description="some description"' ).send();
      expect(res).to.have.status(200);
      expect(res.body.id).to.equal(i);
    });
  }

  it('create a data', async () => {
    const res = await agent.post('/api/editor/pages/a_page1').send({
      description: 'Page #1',
      body: 'a_page1',
      url: '/',
      tags: [tags[0], tags[1]],
    });
    expect(res).to.have.status(200);
  });

  it('get a data by ID', async () => {
    const res = await agent.get('/api/editor/pages/a_page1').send();
    expect(res).to.have.status(200);
    expect(res.body.body).to.equal('a_page1');
  });

  it('update a data', async () => {
    const res = await agent.put('/api/editor/pages/a_page1').send({
      body: 'a_page1_updated',
      tags: [tags[1], tags[4]],
    });
    expect(res).to.have.status(200);
  });

  it('load all pages', async () => {
    const res = await agent.get('/api/editor/pages?sortEntries=id&sortDirection=-1').send();
    expect(res).to.have.status(200);
    expect(res.body.rows[0].body).to.equal('a_page1_updated');
  });

  it('delete a data', async () => {
    const res = await agent.delete('/api/editor/pages/a_page1').send();
    expect(res).to.have.status(200);
  });

});
