/**
 * Provides an interface for the Anvil Connect Users CRUD API.
 * Note: All user operations require an access token passed in `options.token`.
 * You can get this token either via an admin user (with an `authority` role
 * assigned to them) login, OR via a Client Credentials Grant request
 * (see `client.getClientAccessToken()` docs in `../index.js`).
 * Example Usage:
 *
 *   ```
 *   client.getClientAccessToken()
 *     .then(function (accessToken) {
 *       var options = { token: accessToken }
 *       // Once you have the access token you can
 *       //   call client.users.update(), create(), delete(), etc
 *       return client.users.create(userData, options)
 *     })
 *   ```
 * @module users
 */

/**
 * Module dependencies
 */
var request = require('../lib/request')

/**
 * Retrieves a list of user accounts via a REST request to the AnvilConnect
 * server's `/users` API.
 * @method listUsers
 * @param options {Object} Options hashmap object
 * @param options.token {String} (Required) Access token. Gets sent as an
 *   Authorization: Bearer <token> header.
 * @param [options.headers={}] {Object} Optional hashmap of additional headers
 * @return {Promise<Request>}
 */
function listUsers (options) {
  options = options || {}
  options.url = '/v1/users'
  return request.bind(this)(options)
}
exports.list = listUsers

/**
 * Retrieves a user's account details via a REST request to the AnvilConnect
 * server's `/users` API.
 * @method getUser
 * @param id {String} User ID (`sub` in the ID Token)
 * @param options {Object} Options hashmap object
 * @param options.token {String} (Required) Access token. Gets sent as an
 *   Authorization: Bearer <token> header.
 * @param [options.headers={}] {Object} Optional hashmap of additional headers
 * @return {Promise<Request>}
 */
function getUser (id, options) {
  options = options || {}
  options.url = '/v1/users/' + id
  return request.bind(this)(options)
}
exports.get = getUser

/**
 * Creates a user via a REST request to the AnvilConnect server's /users API.
 * Usage:
 *
 *   ```
 *   var userData = {
 *     email: 'alice@example.com',
 *     name: 'Alice',
 *     password: 'swordfish'
 *   }
 *   client.getClientAccessToken()
 *     .then(function (accessToken) {
 *       var options = { token: accessToken }
 *       return client.users.create(userData, options)
 *     })
 *   ```
 * @method createUser
 * @param data {Object} User details object
 * @param options {Object} Options hashmap object
 * @param options.token {String} (Required) Access token. Gets sent as an
 *   Authorization: Bearer <token> header.
 * @param [options.headers={}] {Object} Optional hashmap of additional headers
 * @return {Promise<Request>}
 */
function createUser (data, options) {
  options = options || {}
  options.url = '/v1/users'
  options.method = 'POST'
  options.json = data
  return request.bind(this)(options)
}
exports.create = createUser

/**
 * Updates a user via a REST request to the AnvilConnect server's /users API.
 * Note: You cannot update a user's password using this call (the field gets
 * ignored by the /users endpoint).
 * @method updateUser
 * @param id {String} User ID (`sub` in the ID Token)
 * @param data {Object} User details object
 * @param options {Object} Options hashmap object
 * @param options.token {String} (Required) Access token. Gets sent as an
 *   Authorization: Bearer <token> header.
 * @param [options.headers={}] {Object} Optional hashmap of additional headers
 * @return {Promise<Request>}
 */
function updateUser (id, data, options) {
  options = options || {}
  options.url = '/v1/users/' + id
  options.method = 'PATCH'
  options.json = data
  return request.bind(this)(options)
}
exports.update = updateUser

/**
 * Deletes a user via a REST request to the AnvilConnect server's /users API.
 * @method deleteUser
 * @param id {String} User ID (`sub` in the ID Token).
 * @param options {Object} Options hashmap object
 * @param options.token {String} (Required) Access token. Gets sent as an
 *   Authorization: Bearer <token> header.
 * @param [options.headers={}] {Object} Optional hashmap of additional headers
 * @return {Promise<Request>}
 */
function deleteUser (id, options) {
  options = options || {}
  options.url = '/v1/users/' + id
  options.method = 'DELETE'
  delete options.json
  return request.bind(this)(options)
}
exports.delete = deleteUser

/**
 * Retrieves a user's account details via a REST request to the AnvilConnect
 * server's `/users/email` API.
 * @method getUserByEmail
 * @param email {String} User email
 * @param options {Object} Options hashmap object
 * @param options.token {String} (Required) Access token. Gets sent as an
 *   Authorization: Bearer <token> header.
 * @param [options.headers={}] {Object} Optional hashmap of additional headers
 * @return {Promise<Request>}
 */
function getUserByEmail (email, options) {
  options = options || {}
  options.url = '/v1/users/email/' + email
  return request.bind(this)(options)
}
exports.getByEmail = getUserByEmail
