module.exports = {
  identity: 'unsafewidget',
  datastore: 'default',
  primaryKey: 'id',
  attributes: {
    id: { type: 'number', autoIncrement: true },
    name: { type: 'string', allowNull: true }
  }
};
