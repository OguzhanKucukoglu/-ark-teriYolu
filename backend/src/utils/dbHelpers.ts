import { Sequelize, Transaction, QueryTypes } from 'sequelize';

export async function insertQuery(
  sequelize: Sequelize,
  sql: string,
  replacements: unknown[],
  transaction?: Transaction
): Promise<number> {
  try {
    const [insertId] = await sequelize.query(sql, {
      replacements: replacements.length > 0 ? replacements : undefined,
      type: QueryTypes.INSERT,
      ...(transaction ? { transaction } : {}),
    });
    return insertId as number;
  } catch (err) {
    console.error('insertQuery ERROR:', err instanceof Error ? err.message : err);
    console.error('SQL:', sql);
    console.error('Replacements count:', replacements.length);
    throw err;
  }
}

export async function selectQuery<T = Record<string, unknown>>(
  sequelize: Sequelize,
  sql: string,
  replacements: unknown[],
  transaction?: Transaction
): Promise<T[]> {
  try {
    const rows = await sequelize.query(sql, {
      replacements: replacements.length > 0 ? replacements : undefined,
      type: QueryTypes.SELECT,
      ...(transaction ? { transaction } : {}),
    });
    return rows as T[];
  } catch (err) {
    console.error('selectQuery ERROR:', err instanceof Error ? err.message : err);
    console.error('SQL:', sql);
    throw err;
  }
}
