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

describe.only('Files editing', () => {
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


/*
  it('get config', async () => {
    const res = await agent.get('/api/admin/settings').send();
    expect(res).to.have.status(200);
  });

  it('set config', async () => {
    const res = await agent.post('/api/admin/settings').send({
      locales: ['en', 'ru', 'de'],
    });
    expect(res).to.have.status(200);
  });

  it('get config', async () => {
    const res = await agent.get('/api/admin/settings').send();
    expect(res).to.have.status(200);
    expect(res.body.locales.includes('de')).to.equal(true);
  });

  it('set config', async () => {
    const res = await agent.post('/api/admin/settings').send({
      locales: ['en', 'ru'],
    });
    expect(res).to.have.status(200);
  });*/

  it('register new user with correct credentials', async () => {
    const res = await agent.post('/api/entrance/signup').send({
      email: 'test@test.com',
      password: '123123123',
    });
    expect(res).to.have.status(200);
  });

  it('get user by email', async () => {
    const res = await agent.get('/api/admin/users?email=test@test.com').send();
    expect(res.body.count).to.equal(1);
    expect(res.body.rows[0].email).to.equal('test@test.com');
    expect(res).to.have.status(200);
  });

  it('set user role', async () => {
    const res = await agent.post('/api/admin/users').send({
      email: 'test@test.com',
      role: 'editor',
    });
    expect(res).to.have.status(200);
  });

  it('get user by role', async () => {
    const res = await agent.get('/api/admin/users?role=editor').send();
    expect(res.body.count).to.equal(1);
    expect(res.body.rows[0].email).to.equal('test@test.com');
    expect(res).to.have.status(200);
  });

});
