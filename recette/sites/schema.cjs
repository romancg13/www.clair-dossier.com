const {sqliteTable,text,integer,blob,uniqueIndex,index} = require('drizzle-orm/sqlite-core');
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
},table=>[uniqueIndex('one_pair_per_persona').on(table.sandbox,table.persona),index('ready_runs').on(table.status,table.due)]);
module.exports = {sandboxes,runs};
