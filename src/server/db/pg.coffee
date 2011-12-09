# This is an implementation of the OT data backend for PostgreSQL.

pg = require('pg').native

module.exports = (options) ->
  @client = new pg.Client options.uri
  @client.connect()

  close: =>
    @client.end()

  create: (docName, docData, callback) =>
    sql = """
      INSERT INTO "#{options.snapshot_table}" ("#{options.document_name_column}", "version", "snapshot", "meta", "type", "created_at")
        VALUES ($1, $2, $3, $4, $5, now())
    """
    values = [docName, docData.v, JSON.stringify(docData.snapshot), JSON.stringify(docData.meta), docData.type]
    @client.query sql, values, (error, result) ->
      if !error?
        callback?()
      else if error.toString().match "duplicate key value violates unique constraint"
        callback? "Document already exists"
      else
        callback? error

  delete: (docName, dbMeta, callback) =>
    sql = """
      DELETE FROM "#{options.operations_table}"
      WHERE "#{options.document_name_column}" = $1
      RETURNING *
    """
    values = [docName]
    @client.query sql, values, (error, result) ->
      if !error?
        sql = """
          DELETE FROM "#{options.snapshot_table}"
          WHERE "#{options.document_name_column}" = $1
          RETURNING *
        """
        @client.query sql, values, (error, result) ->
          if !error? and result.rows.length > 0
            callback?()
          else if !error?
            callback? "Document does not exist"
          else
            callback? error
      else
        callback? error

  getSnapshot: (docName, callback) =>
    sql = """
      SELECT *
      FROM "#{options.snapshot_table}"
      WHERE "#{options.document_name_column}" = $1
      ORDER BY "version" DESC
      LIMIT 1
    """
    values = [docName]
    @client.query sql, values, (error, result) ->
      if !error? and result.rows.length > 0
        row = result.rows[0]
        data =
          v:        row.version
          snapshot: JSON.parse(row.snapshot)
          meta:     JSON.parse(row.meta)
          type:     row.type
        callback? null, data
      else if !error?
        callback? "Document does not exist"
      else
        callback? error

  writeSnapshot: (docName, docData, dbMeta, callback) =>
    sql = """
      INSERT INTO "#{options.snapshot_table}" ("#{options.document_name_column}", "version", "snapshot", "meta", "type", "created_at")
        VALUES ($1, $2, $3, $4, $5, now())
    """
    values = [docName, docData.v, JSON.stringify(docData.snapshot), JSON.stringify(docData.meta), docData.type]
    @client.query sql, values, (error, result) ->
      if !error?
        callback?()
      else
        callback? error

  getOps: (docName, start, end, callback) =>
    end = if end? then end - 1 else 2147483647
    sql = """
      SELECT *
      FROM "#{options.operations_table}"
      WHERE "version" BETWEEN $1 AND $2
      ORDER BY "version" ASC
    """
    values = [start, end]
    @client.query sql, values, (error, result) ->
      if !error?
        data = result.rows.map (row) -> {
          op:   JSON.parse row.operation
          v:    row.version
          meta: JSON.parse row.meta
        }
        callback? null, data
      else
        callback? error

  writeOp: (docName, opData, callback) =>
    sql = """
      INSERT INTO "#{options.operations_table}" ("#{options.document_name_column}", "operation", "version", "meta", "created_at")
        VALUES ($1, $2, $3, $4, now())
    """
    values = [docName, JSON.stringify(opData.op), opData.v, JSON.stringify(opData.meta)]
    @client.query sql, values, (error, result) ->
      if !error?
        callback?()
      else
        callback? error
