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

describe('Chunks editing', () => {
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
    it('create tag '+i, async () => {
      const res = await agent.get('/api/editor/chunks/tags/'+i+'?description="some description"' ).send();
      expect(res).to.have.status(200);
      expect(res.body.id).to.equal(i);
    });
  }

  /**
   * TEST CHUNKS
   */
  it('create a chunk', async () => {
    const res = await agent.post('/api/editor/chunks/a_chunk5').send({
      description: 'Chunk A #5',
      body: '<div> Chunk A #5 </div>/n<div><%- include("b_chunk3"); %></div>',
      tags: [tags[0], tags[3]],
    });
    expect(res).to.have.status(200);
  });

  it('create a chunk with same ID', async () => {
    const res = await agent.post('/api/editor/chunks/a_chunk5').send({
      description: 'Chunk A #5s',
      body: '<div> Chunk A #5s </div>/n<div><%- include("b_chunk3"); %></div>',
    });
    expect(res).to.have.status(409);
  });

  it('get a chunk by ID', async () => {
    const res = await agent.get('/api/editor/chunks/a_chunk5').send();
    expect(res).to.have.status(200);
    expect(res.body.description).to.equal('Chunk A #5');
  });

  it('get a lost chunk', async () => {
    const res = await agent.get('/api/editor/chunks/a_chunk6').send();
    expect(res).to.have.status(404);
  });

  it('create another chunk', async () => {
    const res = await agent.post('/api/editor/chunks/b_chunk3').send({
      description: 'Chunk B #3',
      body: '<div> Chunk B #3 </div>',
    });
    expect(res).to.have.status(200);
  });

  it('get a rendered chunk by ID', async () => {
    const res = await agent.get('/api/editor/chunks/a_chunk5?render=true').send();
    expect(res).to.have.status(200);
    expect(res.body.body).to.equal('<div> Chunk A #5 </div>/n<div><div> Chunk B #3 </div></div>');
  });

  it('create third chunk', async () => {
    const res = await agent.post('/api/editor/chunks/e_chunk1').send({
      description: 'Chunk E #1',
      body: '<div> Chunk E #1 </div>',
    });
    expect(res).to.have.status(200);
  });

  it('load all chunks', async () => {
    const res = await agent.get('/api/editor/chunks?sortEntries=id&sortDirection=-1').send();
    expect(res).to.have.status(200);
    expect(res.body.rows[0].id).to.equal('a_chunk5');
    expect(res.body.rows[1].id).to.equal('b_chunk3');
    expect(res.body.rows[2].id).to.equal('e_chunk1');
  });


  it('update a chunk', async () => {
    const res = await agent.put('/api/editor/chunks/a_chunk5').send({
      tags: [tags[1], tags[4]],
    });
    expect(res).to.have.status(200);
  });

  it('get a chunk by ID to check update', async () => {
    const res = await agent.get('/api/editor/chunks/a_chunk5/tags').send();
    expect(res).to.have.status(200);
    expect(res.body[0].id).to.equal(tags[4]);
    expect(res.body[1].id).to.equal(tags[1]);
  });


  it('delete a chunk', async () => {
    const res = await agent.delete('/api/editor/chunks/e_chunk1').send();
    expect(res).to.have.status(200);
  });

  it('load all chunks again', async () => {
    const res = await agent.get('/api/editor/chunks?sortEntries=id&sortDirection=-1').send();
    expect(res).to.have.status(200);
    expect(res.body.count).to.equal(2);
    expect(res.body.rows[0].id).to.equal('a_chunk5');
    expect(res.body.rows[1].id).to.equal('b_chunk3');
  });

  it('delete a chunk a_chunk5', async () => {
    const res = await agent.delete('/api/editor/chunks/a_chunk5').send();
    expect(res).to.have.status(200);
  });

  it('load all chunks again', async () => {
    const res = await agent.get('/api/editor/chunks?sortEntries=id&sortDirection=-1').send();
    expect(res).to.have.status(200);
    expect(res.body.count).to.equal(1);
  });

  it('delete a chunk b_chunk3', async () => {
    const res = await agent.delete('/api/editor/chunks/b_chunk3').send();
    expect(res).to.have.status(200);
  });

  it('load all chunks again', async () => {
    const res = await agent.get('/api/editor/chunks?sortEntries=id&sortDirection=-1').send();
    expect(res).to.have.status(200);
    expect(res.body.count).to.equal(0);
  });

});
