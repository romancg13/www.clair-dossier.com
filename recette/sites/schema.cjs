const {sqliteTable,text,integer,blob,uniqueIndex,index,primaryKey} = require('drizzle-orm/sqlite-core');
const sandboxes = sqliteTable('sandboxes',{
  id:text('id').primaryKey(),persona:text('persona').notNull(),expires:integer('expires').notNull(),
});
const runs = sqliteTable('runs',{
  id:text('id').primaryKey(),sandbox:text('sandbox').notNull().references(()=>sandboxes.id,{onDelete:'cascade'}),
  persona:text('persona').notNull(),status:text('status').notNull(),submitted:integer('submitted').notNull(),
  due:integer('due').notNull(),inputPdf:blob('input_pdf').notNull(),inputScan:blob('input_scan').notNull(),
  lease:text('lease'),leaseEnd:integer('lease_end'),attempts:integer('attempts').notNull().default(0),
  publishedAt:integer('published_at'),summary:text('summary'),draft:text('draft'),outputPdf:blob('output_pdf'),
  notifications:integer('notifications').notNull().default(0),
  revision:integer('revision').notNull().default(1),publishedRevision:integer('published_revision').notNull().default(0),
  closed:integer('closed').notNull().default(0),lots:integer('lots').notNull().default(1),
  lastAdded:integer('last_added').notNull().default(2),lotCommand:text('lot_command'),retainedDate:text('retained_date'),
  corrections:text('corrections').notNull().default('[]'),
},table=>[uniqueIndex('one_pair_per_persona').on(table.sandbox,table.persona),index('ready_runs').on(table.status,table.due)]);
const deliveries = sqliteTable('deliveries',{
  runId:text('run_id').notNull().references(()=>runs.id,{onDelete:'cascade'}),revision:integer('revision').notNull(),
  publishedAt:integer('published_at').notNull(),summary:text('summary').notNull(),draft:text('draft').notNull(),
  deadline:text('deadline'),dateSource:text('date_source').notNull(),action:text('action').notNull(),
  extraction:text('extraction').notNull(),pdf:blob('pdf').notNull(),pack:blob('pack'),fileCount:integer('file_count').notNull().default(1),
},table=>[primaryKey({columns:[table.runId,table.revision]})]);
const connectorGrants=sqliteTable('connector_grants',{
  subject:text('subject').primaryKey(),sandbox:text('sandbox').notNull().references(()=>sandboxes.id,{onDelete:'cascade'}),
  persona:text('persona').notNull(),expires:integer('expires').notNull(),
});
const lotEvents = sqliteTable('lot_events',{
  runId:text('run_id').notNull().references(()=>runs.id,{onDelete:'cascade'}),revision:integer('revision').notNull(),
  submitted:integer('submitted').notNull(),publishedAt:integer('published_at'),publishedRevision:integer('published_revision'),
},table=>[primaryKey({columns:[table.runId,table.revision]})]);
const serviceDrafts=sqliteTable('service_drafts',{
  runId:text('run_id').notNull().references(()=>runs.id,{onDelete:'cascade'}),kind:text('kind').notNull(),
  result:text('result').notNull(),updated:text('updated').notNull(),
},table=>[primaryKey({columns:[table.runId,table.kind]})]);
module.exports = {sandboxes,runs,deliveries,connectorGrants,lotEvents,serviceDrafts};
