# Test dependencies
cwd         = process.cwd()
path        = require 'path'
chai        = require 'chai'
sinon       = require 'sinon'
sinonChai   = require 'sinon-chai'
expect      = chai.expect
nock        = require 'nock'




# Assertions
chai.use sinonChai
chai.should()




users = require path.join(cwd, 'rest', 'users')




describe 'REST API User Methods', ->

  describe 'list', ->

    describe 'with a missing access token', ->

      {promise,success,failure} = {}

      beforeEach (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .get('/v1/users')
          .reply(200, [{_id: 'uuid'}])

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.list.bind(instance)()
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide users', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.calledWith sinon.match.instanceOf Error


    describe 'with a successful response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .get('/v1/users')
          .reply(200, [{_id: 'uuid'}])

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.list.bind(instance)({ token: 'token' })
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should provide the users', ->
        success.should.have.been.calledWith sinon.match [{_id:'uuid'}]

      it 'should not catch an error', ->
        failure.should.not.have.been.called


    describe 'with a failure response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .get('/v1/users')
          .reply(404, 'Not found')

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.list.bind(instance)({ token: 'token' })
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide the users', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.called


  describe 'get', ->

    describe 'with a missing access token', ->

      {promise,success,failure} = {}

      beforeEach (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .get('/v1/users/uuid')
          .reply(200, [{_id: 'uuid'}])

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.get.bind(instance)('uuid')
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide users', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.calledWith sinon.match.instanceOf Error


    describe 'with a successful response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          tokens:
            access_token: 'random'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .get('/v1/users/uuid')
          .reply(200, {_id: 'uuid'})

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.get.bind(instance)('uuid', { token: 'token' })
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should provide the user', ->
        success.should.have.been.calledWith sinon.match {_id:'uuid'}

      it 'should not catch an error', ->
        failure.should.not.have.been.called


    describe 'with a failure response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          tokens:
            access_token: 'random'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .get('/v1/users/uuid')
          .reply(404, 'Not found')

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.get.bind(instance)('uuid', { token: 'token' })
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide the user', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.called

  describe 'getByEmail', ->

    describe 'with a missing access token', ->
      {promise,success,failure} = {}

      beforeEach (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .get('/v1/users/email/mail')
          .reply(200, {_id: 'uuid', email: 'mail'})

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.getByEmail.bind(instance)('uuid')
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide users', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.calledWith sinon.match.instanceOf Error


    describe 'with a successful response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          tokens:
            access_token: 'random'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .get('/v1/users/email/mail')
          .reply(200, {_id: 'uuid', email: 'mail'})

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.getByEmail.bind(instance)('mail', { token: 'token' })
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should provide the user', ->
        success.should.have.been.calledWith sinon.match {_id: 'uuid', email: 'mail'}

      it 'should not catch an error', ->
        failure.should.not.have.been.called

    describe 'with a failure response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          tokens:
            access_token: 'random'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .get('/v1/users/email/mail')
          .reply(404, 'Not found')

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.getByEmail.bind(instance)('mail', { token: 'token' })
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide the user', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.called

  describe 'create', ->

    describe 'with a missing access token', ->

      {promise,success,failure} = {}

      beforeEach (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .post('/v1/users')
          .reply(200, [{_id: 'uuid'}])

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.create.bind(instance)({})
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide user', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.calledWith sinon.match.instanceOf Error


    describe 'with a successful response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          tokens:
            access_token: 'random'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .post('/v1/users', {
            redirect_uris: ['https://example.anvil.io']
          })
          .reply(201, {
            _id: 'uuid'
            redirect_uris: ['https://example.anvil.io']
          })

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.create.bind(instance)({
          redirect_uris: ['https://example.anvil.io']
        }, {
          token: 'token'
        }).then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should provide the user', ->
        success.should.have.been.calledWith sinon.match {_id:'uuid'}

      it 'should not catch an error', ->
        failure.should.not.have.been.called


    describe 'with a failure response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          tokens:
            access_token: 'random'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .post('/v1/users', {})
          .reply(400, 'Bad request')

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.create.bind(instance)({
          redirect_uris: ['https://example.anvil.io']
        }, {
          token: 'token'
        }).then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide the user', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.called




  describe 'update', ->

    describe 'with a missing access token', ->

      {promise,success,failure} = {}

      beforeEach (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .patch('/v1/users/uuid')
          .reply(200, {_id: 'uuid'})

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.update.bind(instance)('uuid', {})
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide user', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.calledWith sinon.match.instanceOf Error



    describe 'with a successful response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          tokens:
            access_token: 'random'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .patch('/v1/users/uuid', {
            redirect_uris: ['https://example.anvil.io']
          })
          .reply(200, {
            _id: 'uuid'
            redirect_uris: ['https://example.anvil.io']
          })

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.update.bind(instance)('uuid', {
          redirect_uris: ['https://example.anvil.io']
        }, {
          token: 'token'
        }).then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should provide the user', ->
        success.should.have.been.calledWith sinon.match({
          redirect_uris: ['https://example.anvil.io']
        })

      it 'should not catch an error', ->
        failure.should.not.have.been.called


    describe 'with a failure response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          tokens:
            access_token: 'random'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .patch('/v1/users/uuid', {})
          .reply(400, 'Bad request')

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.update.bind(instance)('uuid', {
          redirect_uris: ['https://example.anvil.io']
        }, {
          token: 'token'
        }).then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide the user', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.called



  describe 'delete', ->

    describe 'with a missing access token', ->

      {promise,success,failure} = {}

      beforeEach (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .delete('/v1/users/uuid')
          .reply(401, 'Unauthorized')

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.delete.bind(instance)('uuid')
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide user', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.calledWith sinon.match.instanceOf Error



    describe 'with a successful response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          tokens:
            access_token: 'random'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .delete('/v1/users/uuid')
          .reply(204)

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.delete.bind(instance)('uuid', { token: 'token' })
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should provide the user', ->
        success.should.have.been.called

      it 'should not catch an error', ->
        failure.should.not.have.been.called


    describe 'with a failure response', ->

      {promise,success,failure} = {}

      before (done) ->
        instance =
          configuration:
            issuer: 'https://connect.anvil.io'
          tokens:
            access_token: 'random'
          agentOptions: {}

        nock.cleanAll()
        nock(instance.configuration.issuer)
          .delete('/v1/users/uuid')
          .reply(404, 'Not found')

        success = sinon.spy -> done()
        failure = sinon.spy -> done()

        promise = users.delete.bind(instance)('uuid', { token: 'token' })
          .then(success, failure)

      it 'should return a promise', ->
        promise.should.be.instanceof Promise

      it 'should not provide the user', ->
        success.should.not.have.been.called

      it 'should catch an error', ->
        failure.should.have.been.called


