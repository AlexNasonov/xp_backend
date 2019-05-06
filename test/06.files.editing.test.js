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

describe('Files editing', () => {
  let agent;

  before(async () => {
    agent = chai.request.agent(server);
    /* await models.sequelize.sync({
      force: true,
    });*/
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



  it('read dir contents', async () => {
    const res = await agent.get('/api/files/dir?url=samples').send();
    expect(res).to.have.status(200);
  });

  it('create new directory - wrong path', async () => {
    const res = await agent.post('/api/files/dir').send({
      url: '/samples/s1/ss3',
    });
    expect(res).to.have.status(404);
  });

  it('create new directory', async () => {
    const res = await agent.post('/api/files/dir').send({
      url: '/samples/s1',
    });
    expect(res).to.have.status(200);
  });

  it('upload a file', async () => {
    agent.post('/api/files/upload')
        .set('Content-Type', 'multipart/formdata')
        .field('dir', '/samples/s1')
        .attach('file', './test/test.png')
        .then((result) => {
          testFile = result.body;
          expect(result).to.have.status(200);
        });
  });

  it('delete file', async () => {
    const testFile = '/samples/s1/test.png';
    const res = await agent.delete(`/api/files/file?url=${testFile}`).send();
    expect(res).to.have.status(200);
  });

  it('delete directory', async () => {
    const res = await agent.delete('/api/files/dir?url=/samples/s1').send();
    expect(res).to.have.status(200);
  });
});
