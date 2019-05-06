process.env.TEST_ENV = true; // disable server's sequelize.sync
process.env.NODE_ENV = 'development'; //

const models = require('../modules/sequelize');
const chai = require('chai');
const server = require('../index');
const chaiHttp = require('chai-http');

const email = 'nasonov.alexey@gmail.com';

const expect = chai.expect;

chai.use(chaiHttp);

describe('User registration', () => {
  let agent;

  before(async () => {
    agent = chai.request.agent(server);
    await models.sequelize.sync({
      force: true,
    });
  });

  it('register new user with bad password', async () => {
    const res = await agent.post('/api/entrance/signup').send({
      email: email,
      password: '123123',
    });
    expect(res).to.have.status(400);
  });

  it('register new user with bad email', async () => {
    const res = await agent.post('/api/entrance/signup').send({
      email: 'wrong.email.com',
      password: '123123123',
    });
    expect(res).to.have.status(400);
  });

  it('register new user with correct credentials', async () => {
    const res = await agent.post('/api/entrance/signup').send({
      email: email,
      password: '123123123',
    });
    expect(res).to.have.status(200);
  });

  it('register existing user', async () => {
    const res = await agent.post('/api/entrance/signup').send({
      email: email,
      password: '123123123',
    });
    expect(res).to.have.status(409);
  });

  it('signin with wrong password', async () => {
    const res = await agent.post('/api/entrance/signin').send({
      email: email,
      password: '123123',
    });
    expect(res).to.have.status(401);
  });

  it('request password recovery', async () => {
    const res = await agent.get('/api/entrance/recover?email='+email).send();
    expect(res).to.have.status(200);
  });

  it('set new password', async () => {
    const res = await agent.put('/api/entrance/recover').send({
      email: email,
      password: '789789789',
      code: 'test-code',
    });
    expect(res).to.have.status(200);
  });

  it('signin correctly', async () => {
    const res = await agent.post('/api/entrance/signin').send({
      email: email,
      password: '789789789',
    });
    expect(res).to.have.status(200);
  });

  it('load profile', async () => {
    const res = await agent.get('/api/entrance/whoami');
    expect(res).to.have.status(200);
    expect(res.body.email).to.equal(email);
    expect(res.body.role).to.equal('guest');
  });

  it('signout', async () => {
    const res = await agent.post('/api/entrance/signout').send();
    expect(res).to.have.status(200);
  });
});
