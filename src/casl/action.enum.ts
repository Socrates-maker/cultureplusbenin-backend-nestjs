export enum Action {
  Manage = 'manage', // wildcard — any action
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Approve = 'approve', // validate (approve / reject) user-submitted content
}
