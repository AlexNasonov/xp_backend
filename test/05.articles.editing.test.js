process.env.TEST_ENV = true; // disable server's sequelize.sync
process.env.NODE_ENV = 'development'; //

const models = require('../modules/sequelize');
const chai = require('chai');
const server = require('../index');
const chaiHttp = require('chai-http');
const config = require('../modules/config');

const email = config.get('admin');
const password = '123123123';
const tags = ['a_a_tag1', 'd_a_tag2', 'ec_a_tag3', 'b_a_tag4', 'c_a_tag5'];

const expect = chai.expect;

chai.use(chaiHttp);

describe('Articles editing', () => {
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
      const res = await agent.get('/api/editor/articles/tags/'+i+'?description="some description"' ).send();
      expect(res).to.have.status(200);
      expect(res.body.id).to.equal(i);
    });
  }

  it('create an data', async () => {
    const res = await agent.post('/api/editor/articles/a_art1').send({
      description: 'Art #1',
      body: 'a_art1',
      url: '/',
      tags: [tags[0], tags[1]],
    });
    expect(res).to.have.status(200);
  });

  it('get an data by ID', async () => {
    const res = await agent.get('/api/editor/articles/a_art1').send();
    expect(res).to.have.status(200);
    expect(res.body.body).to.equal('a_art1');
  });

  it('update an data', async () => {
    const res = await agent.put('/api/editor/articles/a_art1').send({
      body: 'a_art1_updated',
      tags: [tags[1], tags[4]],
    });
    expect(res).to.have.status(200);
  });

  it('load all articles', async () => {
    const res = await agent.get('/api/editor/articles?sortEntries=id&sortDirection=-1').send();
    expect(res).to.have.status(200);
    expect(res.body.rows[0].body).to.equal('a_art1_updated');
  });

  it('delete an data', async () => {
    const res = await agent.delete('/api/editor/articles/a_art1').send();
    expect(res).to.have.status(200);
  });

});
