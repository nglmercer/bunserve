// Import necessary modules
import { Database, Statement, type SQLQueryBindings } from 'bun:sqlite';
import { join } from 'node:path';

// --- Configuration ---
export const dbPath = join(import.meta.dir, 'db.db');

// --- Database Controller Class ---
class DatabaseController {
  private dbPath: string;

  constructor(databasePath: string = dbPath) {
    this.dbPath = databasePath;
  }

  /**
   * Internal helper to open database connection.
   * @param {boolean} readonly - Open in read-only mode.
   * @returns {Database} - The Bun SQLite Database instance.
   */
  private _open(readonly: boolean = false): Database {
    try {
      return new Database(this.dbPath, { readonly, create: true });
    } catch (err: any) {
      throw new Error(`Failed to open database: ${err.message}`);
    }
  }

  // --- Core Query Methods ---

  /**
   * Query database table with multiple filters.
   * @param tableName - The name of the table.
   * @param filters - An object of column-value pairs for the WHERE clause.
   * @returns Promise resolving to an array of rows or a single row if only one matches.
   */
  async queryWithFilters<T = any>(tableName: string, filters: Record<string, SQLQueryBindings> = {}): Promise<T[] | T> {
    if (!await this.tableExists(tableName)) {
      throw new Error(`Table ${tableName} does not exist`);
    }

    let db: Database | null = null;
    try {
      db = this._open(true);
      const entries = Object.entries(filters);
      const where = entries.length
        ? `WHERE ${entries.map(([column]) => `\`${column}\` = ?`).join(' AND ')}`
        : '';
      const sql = `SELECT * FROM \`${tableName}\` ${where}`;
      const stmt: Statement<T> = db.prepare(sql);
      const values = entries.map(([, value]) => value);
      const rows = stmt.all(...values);

      if (!rows || rows.length === 0) return [];
      return rows.length === 1 ? rows[0] : rows;
    } catch (err: any) {
      throw new Error(`queryWithFilters failed for table ${tableName}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  /**
   * Get records with pagination (LIMIT/OFFSET).
   * @param tableName - The name of the table.
   * @param limit - Max number of records per page.
   * @param offset - Starting offset for records.
   * @returns Promise resolving to an array of rows.
   */
  async getRecords<T = any>(tableName: string, limit: number = 10, offset: number = 0): Promise<T[]> {
    if (!await this.tableExists(tableName)) {
      throw new Error(`Table ${tableName} does not exist`);
    }
    let db: Database | null = null;
    try {
      db = this._open(true);
      const sql = `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`;
      const stmt: Statement<T> = db.prepare(sql);
      const rows = stmt.all(limit, offset);
      return rows ?? [];
    } catch (err: any) {
      throw new Error(`getRecords failed for table ${tableName}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  /**
   * Get a single record by its primary ID.
   * @param tableName - The name of the table.
   * @param id - The ID of the record.
   * @returns Promise resolving to the row object or undefined if not found.
   */
  async getById<T = any>(tableName: string, id: number | string): Promise<T | null> {
    if (!await this.tableExists(tableName)) {
      throw new Error(`Table ${tableName} does not exist`);
    }
    let db: Database | null = null;
    try {
      db = this._open(true);
      const sql = `SELECT * FROM \`${tableName}\` WHERE id = ? LIMIT 1`;
      const stmt: Statement<T> = db.prepare(sql);
      const row = stmt.get(id);
      return row;
    } catch (err: any) {
      throw new Error(`getById failed for table ${tableName}, id ${id}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  // --- Schema Introspection Methods ---

  /**
   * Lists all user-defined tables in the database.
   * @returns Promise resolving to an array of table info objects.
   */
  async listTables(): Promise<{ name: string, sql: string }[]> {
    let db: Database | null = null;
    try {
      db = this._open(true);
      const sql = `
        SELECT name, sql
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      `;
      const stmt = db.prepare(sql);
      const tables = stmt.all() as { name: string, sql: string }[];
      return tables ?? [];
    } catch (err: any) {
      throw new Error(`listTables failed: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  /**
   * Checks if a specific table exists in the database.
   * @param tableName - The name of the table to check.
   * @returns Promise resolving to true if the table exists, false otherwise.
   */
  async tableExists(tableName: string): Promise<boolean> {
    let db: Database | null = null;
    try {
      db = this._open(true);
      const sql = "SELECT name FROM sqlite_master WHERE type='table' AND name = ?";
      const stmt = db.prepare(sql);
      const result = stmt.get(tableName);
      return !!result;
    } catch (err: any) {
      console.error(`Error checking if table ${tableName} exists: ${err.message}`);
      return false;
    } finally {
      db?.close();
    }
  }

  /**
   * Get column information for a specific table using PRAGMA table_info.
   * @param tableName - The name of the table.
   * @returns Promise resolving to an array of column definition objects.
   */
  async getTableColumns(tableName: string): Promise<{ cid: number; name: string; type: string; notnull: number; dflt_value: any; pk: number; }[]> {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error(`Invalid table name format: ${tableName}`);
    }
    let db: Database | null = null;
    try {
      db = this._open(true);
      const sql = `PRAGMA table_info(\`${tableName}\`)`;
      const cols = db.query(sql).all() as { cid: number; name: string; type: string; notnull: number; dflt_value: any; pk: number; }[];
      return cols ?? [];
    } catch (err: any) {
      throw new Error(`getTableColumns failed for table ${tableName}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  /**
   * Get the total number of rows in a table.
   * @param tableName - The name of the table.
   * @returns Promise resolving to the row count.
   */
  async getRowCount(tableName: string): Promise<number> {
    if (!await this.tableExists(tableName)) {
      return 0;
    }
    let db: Database | null = null;
    try {
      db = this._open(true);
      const sql = `SELECT COUNT(*) AS count FROM \`${tableName}\``;
      const stmt = db.prepare(sql);
      const result = stmt.get() as { count: number } | undefined;
      return result?.count ?? 0;
    } catch (err: any) {
      throw new Error(`getRowCount failed for table ${tableName}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  // --- Search Methods ---

  /**
   * Search for records containing a substring in a specific column.
   * @param tableName - The name of the table.
   * @param column - The column name to search within.
   * @param substring - The substring to search for (case-insensitive using LIKE).
   * @returns Promise resolving to an array of matching rows.
   */
  async searchBySubstring<T = any>(tableName: string, column: string, substring: string): Promise<T[]> {
    if (!await this.tableExists(tableName)) {
      throw new Error(`Table ${tableName} does not exist`);
    }
    if (!/^[a-zA-Z0-9_]+$/.test(column)) {
      throw new Error(`Invalid column name format: ${column}`);
    }

    let db: Database | null = null;
    try {
      db = this._open(true);
      const sql = `SELECT * FROM \`${tableName}\` WHERE \`${column}\` LIKE ?`;
      const searchTerm = `%${substring}%`;
      const stmt: Statement<T> = db.prepare(sql);
      const rows = stmt.all(searchTerm);
      return rows ?? [];
    } catch (err: any) {
      throw new Error(`searchBySubstring failed for table ${tableName}, column ${column}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  /**
   * Search across all columns in a table for records containing a substring.
   * @param tableName - The name of the table.
   * @param substring - The substring to search for.
   * @returns Promise resolving to an array of matching rows.
   */
  async searchAcrossAllColumns<T = any>(tableName: string, substring: string): Promise<T[]> {
    if (!await this.tableExists(tableName)) {
      throw new Error(`Table ${tableName} does not exist`);
    }

    const columns = await this.getTableColumns(tableName);
    if (!columns || columns.length === 0) {
      return [];
    }

    let db: Database | null = null;
    try {
      db = this._open(true);
      const searchTerm = `%${substring}%`;
      const conditions = columns
        .map(col => `\`${col.name}\` LIKE ?`)
        .join(' OR ');
      const sql = `SELECT * FROM \`${tableName}\` WHERE ${conditions}`;
      const params = Array(columns.length).fill(searchTerm);
      const stmt: Statement<T> = db.prepare(sql);
      const rows = stmt.all(...params);
      return rows ?? [];
    } catch (err: any) {
      throw new Error(`searchAcrossAllColumns failed for table ${tableName}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  // --- Data Modification Methods (INSERT, UPDATE, DELETE) ---

  /**
   * Internal helper to check if an ID exists in a specific column.
   */
  private async _checkIdExists(tableName: string, idField: string, idValue: number | string): Promise<boolean> {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(idField)) {
      throw new Error(`Invalid table or field name for _checkIdExists`);
    }
    let db: Database | null = null;
    try {
      db = this._open(true);
      const sql = `SELECT 1 FROM \`${tableName}\` WHERE \`${idField}\` = ? LIMIT 1`;
      const stmt = db.prepare(sql);
      const result = stmt.get(idValue);
      return !!result;
    } catch (err: any) {
      console.error(`_checkIdExists failed: ${err.message}`);
      throw err;
    } finally {
      db?.close();
    }
  }

  /**
   * Internal helper to get the maximum value of an ID field.
   */
  private async _getMaxId(tableName: string, idField: string): Promise<number> {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(idField)) {
      throw new Error(`Invalid table or field name for _getMaxId`);
    }
    let db: Database | null = null;
    try {
      db = this._open(true);
      const sql = `SELECT MAX(\`${idField}\`) as maxId FROM \`${tableName}\``;
      const stmt = db.prepare(sql);
      const result = stmt.get() as { maxId: number | null } | undefined;
      return result?.maxId ?? 0;
    } catch (err: any) {
      throw new Error(`_getMaxId failed for ${tableName}.${idField}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  /**
   * Inserts a new record into the database.
   * @param tableName - The name of the table.
   * @param data - Object containing column-value pairs for the new record.
   * @param idFields - Array of column names that should be treated as IDs.
   * @returns Promise resolving to the inserted data object, including generated IDs.
   */
  async insert<T extends Record<keyof T, unknown>>(
    tableName: string,
    data: T,
    idFields: string[] = ["id"]
  ): Promise<T & { rowid: number | bigint; changes: number }> {
    if (!await this.tableExists(tableName)) {
      throw new Error(`Table ${tableName} does not exist`);
    }
    
    const columns = await this.getTableColumns(tableName);
    const validDbColumnNames = columns.map(c => c.name);
    const newData = { ...data };
    
    // Check for ID conflicts
    for (const idField of idFields) {
      if (validDbColumnNames.includes(idField) && newData.hasOwnProperty(idField) && (newData as Record<string, unknown>)[idField] && (newData as Record<string, unknown>)[idField] !== 0) {
        const exists = await this._checkIdExists(tableName, idField, (newData as Record<string, any>)[idField]);
        if (exists) {
          throw new Error(`Cannot insert: ID ${(newData as Record<string, unknown>)[idField]} already exists in column ${idField} of table ${tableName}`);
        }
      }
    }
    
    // Generate IDs if needed
    for (const idField of idFields) {
      if (validDbColumnNames.includes(idField)) {
        if (!newData.hasOwnProperty(idField) || (newData as Record<string, unknown>)[idField] === 0 || (newData as Record<string, unknown>)[idField] == null) {
          const maxId = await this._getMaxId(tableName, idField);
          (newData as Record<string, unknown>)[idField] = maxId + 1;
        }
      } else {
        console.warn(`ID field '${idField}' specified for auto-increment but does not exist in table '${tableName}'. Skipping.`);
      }
    }
    
    let db: Database | null = null;
    try {
      db = this._open();
      
      // Filter data to include only valid columns
      const fieldsToInsert = Object.keys(newData).filter(key => validDbColumnNames.includes(key));
      if (fieldsToInsert.length === 0) {
        throw new Error(`No valid fields provided for insertion into table ${tableName}.`);
      }
      
      // Build and execute INSERT statement
      const fieldNames = fieldsToInsert.map(f => `\`${f}\``).join(', ');
      const placeholders = fieldsToInsert.map(() => '?').join(', ');
      const sql = `INSERT INTO \`${tableName}\` (${fieldNames}) VALUES (${placeholders})`;
      const values = fieldsToInsert.map(key => (newData as Record<string, unknown>)[key]);
      
      const stmt = db.prepare(sql);
      const result = stmt.run(...(values as SQLQueryBindings[]));
      
      return { ...newData, rowid: result.lastInsertRowid, changes: result.changes };
    } catch (err: any) {
      throw new Error(`insert failed for table ${tableName}: ${err.message}`);
    } finally {
      db?.close();
    }
  }
  
  /**
   * Updates an existing record identified by one or more ID fields.
   * @param tableName - The name of the table.
   * @param data - Object containing data to update. Must include the ID field(s).
   * @param idFields - Array of column names used to identify the record(s) to update.
   * @returns Promise resolving to an object containing the original data and the number of changes made.
   */
  async update<T extends Record<string, any>>(
    tableName: string,
    data: T,
    idFields: string[] = ["id"]
  ): Promise<T & { changes: number }> {
    if (!await this.tableExists(tableName)) {
      throw new Error(`Table ${tableName} does not exist`);
    }

    const columns = await this.getTableColumns(tableName);
    const validDbColumnNames = columns.map(c => c.name);

    // Identify valid ID criteria provided in the data
    const idCriteria = idFields
      .filter(f => validDbColumnNames.includes(f) && data.hasOwnProperty(f) && data[f] && data[f] !== 0)
      .map(f => ({ field: f, value: data[f] }));

    if (idCriteria.length === 0) {
      throw new Error(`Cannot update: No valid ID (${idFields.join(', ')}) provided in data for table ${tableName}`);
    }

    // Identify fields to update (excluding the ID fields used in WHERE)
    const fieldsToUpdate = Object.keys(data)
      .filter(key => validDbColumnNames.includes(key) && !idFields.includes(key));

    if (fieldsToUpdate.length === 0) {
      console.warn(`No fields to update provided (excluding ID fields) for table ${tableName}. No action taken.`);
      return { ...data, changes: 0 };
    }

    let db: Database | null = null;
    try {
      db = this._open();

      // Build the UPDATE statement
      const setClause = fieldsToUpdate.map(f => `\`${f}\` = ?`).join(', ');
      const whereClause = idCriteria.map(item => `\`${item.field}\` = ?`).join(' AND ');
      const sql = `UPDATE \`${tableName}\` SET ${setClause} WHERE ${whereClause}`;

      // Prepare parameter list: SET values first, then WHERE values
      const setValues = fieldsToUpdate.map(key => data[key]);
      const whereValues = idCriteria.map(item => item.value);
      const params = [...setValues, ...whereValues];

      // Execute the statement
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      return { ...data, changes: result.changes };
    } catch (err: any) {
      throw new Error(`update failed for table ${tableName}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  /**
   * Deletes records matching specific ID criteria.
   * @param tableName - The name of the table.
   * @param ids - An object where keys are ID field names and values are the IDs to match for deletion.
   * @param idFields - Array confirming which keys in the `ids` object are actual ID fields.
   * @returns Promise resolving to an object indicating the number of rows deleted.
   */
  async delete(
    tableName: string,
    ids: Record<string, number | string>,
    idFields: string[] = ["id"]
  ): Promise<{ changes: number }> {
    if (!await this.tableExists(tableName)) {
      throw new Error(`Table ${tableName} does not exist`);
    }

    const columns = await this.getTableColumns(tableName);
    const validDbColumnNames = columns.map(c => c.name);

    // Identify valid ID criteria present in the `ids` object
    const idCriteria = idFields
      .filter(f => validDbColumnNames.includes(f) && ids.hasOwnProperty(f) && ids[f] && ids[f] !== 0)
      .map(f => ({ field: f, value: ids[f] }));

    if (idCriteria.length === 0) {
      throw new Error(`Cannot delete: No valid ID (${idFields.join(', ')}) provided in criteria for table ${tableName}`);
    }

    let db: Database | null = null;
    try {
      db = this._open();

      // Build the DELETE statement
      const whereClause = idCriteria.map(item => `\`${item.field}\` = ?`).join(' AND ');
      const sql = `DELETE FROM \`${tableName}\` WHERE ${whereClause}`;

      // Prepare parameters (values from the idCriteria)
      const params = idCriteria.map(item => item.value);

      // Execute the statement
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      return { changes: result.changes };
    } catch (err: any) {
      throw new Error(`delete failed for table ${tableName}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  /**
   * Get records with pagination and ordering.
   * @param options - Pagination and sorting options.
   * @returns Promise resolving to an array of rows.
   */
  async getPaginatedRecords<T = any>({
    tableName,
    page = 1,
    limit = 10,
    orderByColumn = 'rowid',
    orderDirection = 'DESC'
  }: {
    tableName: string;
    page?: number;
    limit?: number;
    orderByColumn?: string;
    orderDirection?: 'ASC' | 'DESC';
  }): Promise<T[]> {
    // Basic input validation
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error(`Invalid table name format: ${tableName}`);
    if (!/^[a-zA-Z0-9_]+$/.test(orderByColumn)) throw new Error(`Invalid orderBy column format: ${orderByColumn}`);
    const direction = orderDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const currentPage = Math.max(1, page);
    const currentLimit = Math.max(1, limit);
    const offset = (currentPage - 1) * currentLimit;

    let db: Database | null = null;
    try {
      db = this._open(true);

      const sql = `
        SELECT *
        FROM \`${tableName}\`
        ORDER BY \`${orderByColumn}\` ${direction}
        LIMIT ? OFFSET ?
      `;
      const stmt: Statement<T> = db.prepare(sql);
      const rows = stmt.all(currentLimit, offset);
      return rows ?? [];
    } catch (err: any) {
      throw new Error(`getPaginatedRecords failed for table ${tableName}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  /**
   * Creates a table if it doesn't exist.
   * @param tableName - The name of the table to create.
   * @param schema - SQL schema definition for the table.
   * @returns Promise resolving to a boolean indicating if the table was created.
   */
  async createTable(tableName: string, schema: string): Promise<boolean> {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error(`Invalid table name format: ${tableName}`);
    }
    
    const exists = await this.tableExists(tableName);
    if (exists) {
      return false; // Table already exists
    }
    
    let db: Database | null = null;
    try {
      db = this._open();
      // Make sure schema is properly formatted with at least one column definition
      if (!schema || schema.trim() === '') {
        throw new Error('Schema cannot be empty');
      }
      
      // Clean up the schema string to ensure it has proper syntax
      const cleanSchema = schema.trim();
      // Check if schema ends with a comma and remove it if it does
      const finalSchema = cleanSchema.endsWith(',') ? cleanSchema.slice(0, -1) : cleanSchema;
      
      const sql = `CREATE TABLE \`${tableName}\` (${finalSchema})`;
      console.log(`Executing SQL: ${sql}`); // Debug the SQL statement
      
      db.run(sql);
      return true; // Table created successfully
    } catch (err: any) {
      throw new Error(`createTable failed for table ${tableName}: ${err.message}`);
    } finally {
      db?.close();
    }
  }

  /**
   * Execute a raw SQL query.
   * @param sql - The SQL statement to execute.
   * @param params - Parameters for the SQL statement.
   * @returns Promise resolving to the query results.
   */
  async executeRawQuery<T = any>(sql: string, params: SQLQueryBindings[] = []): Promise<T[]> {
    let db: Database | null = null;
    try {
      db = this._open();
      const stmt = db.prepare<T, any[]>(sql);
      const result = stmt.all(...params);
      return result ?? [];
    } catch (err: any) {
      throw new Error(`executeRawQuery failed: ${err.message}`);
    } finally {
      db?.close();
    }
  }
}
console.log('Starting Bun server...',dbPath);
// --- Export as singleton ---
export const db = new DatabaseController();
// Example usage
(async () => {
  try {
    // Create a test table
    await db.createTable('episodes', `
      id INTEGER PRIMARY KEY,
      name TEXT,
      message TEXT,
      outputDir TEXT,
      masterPlaylistPath TEXT,
      masterPlaylistUrl TEXT,
      CreatedAt TEXT NOT NULL,
      `);
      /*  message: string;
  outputDir: string;
  masterPlaylistPath: string;
  masterPlaylistUrl: string;*/
      // Insert records
      const randomMail = Math.random() + "@example.com"
      // insertar un nuevo usuario con el mismo email da error
      const objTest =  {
     name: 'John Doe',
     path:  randomMail,
     masterpath: 30,
     CreatedAt: new Date().toLocaleDateString()
    }
    console.log("objTest",objTest);
    /*
    const user1 = await db.insert('episodes',objTest);
    console.log('Inserted user:', user1);
        
                // Get records
                const allUsers = await db.getRecords('users');
                console.log('All users:', allUsers);
                
                // Update a record
                const updated = await db.update('users', {
                  id: user1.id,
                  age: 3221,
                  name: 'John Smith'
                  });
                  console.log('Updated user:', updated);
                  
                  // Search
                  const searchResults = await db.searchBySubstring('users', 'name', 'Smith');
                  console.log('Search results:', searchResults);
                  
                  // Delete
                  const deleted = await db.delete('users', {id: user1.id, });
                  console.log('Delete result:', deleted);
    */
  } catch (err) {
    console.error('Error:', err);
  }
})();