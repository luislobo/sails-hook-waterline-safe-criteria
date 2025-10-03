module.exports = {
  identity: 'openwidget',
  datastore: 'default',
  rejectUndefinedWhere: false,
  primaryKey: 'id',
  attributes: {
    id: { type: 'number', autoIncrement: true },
    name: { type: 'string', allowNull: true }
  }
};
