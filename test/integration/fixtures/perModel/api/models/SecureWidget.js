module.exports = {
  identity: 'securewidget',
  datastore: 'default',
  rejectUndefinedWhere: true,
  primaryKey: 'id',
  attributes: {
    id: { type: 'number', autoIncrement: true },
    name: { type: 'string', allowNull: true }
  }
};
