import { executeQuery, getConnection } from './db';
import type { Connection } from 'mysql2/promise';

/**
 * Notebook (Space) Ordering Operations
 */

export async function getNotebookOrder(userId: number): Promise<number[]> {
  const rows = await executeQuery<Array<{ notebook_id: number }>>(
    'SELECT notebook_id FROM user_notebook_orders WHERE user_id = ? ORDER BY position ASC',
    [userId]
  );

  return rows.map(r => r.notebook_id);
}

export async function updateNotebookOrder(
  userId: number,
  notebookIds: number[],
  connection?: Connection
): Promise<void> {
  const conn = connection || await getConnection();
  const shouldRelease = !connection;

  try {
    // Delete existing orders for this user
    await conn.query('DELETE FROM user_notebook_orders WHERE user_id = ?', [userId]);

    // Insert new orders
    if (notebookIds.length > 0) {
      const values = notebookIds.map((notebookId, position) => [userId, notebookId, position]);

      await conn.query(
        'INSERT INTO user_notebook_orders (user_id, notebook_id, position) VALUES ?',
        [values]
      );
    }
  } finally {
    if (shouldRelease) conn.release();
  }
}

/**
 * Section (Folder) Ordering Operations
 */

export async function getSectionOrder(
  userId: number,
  notebookId?: number
): Promise<Array<{ section_id: number; notebook_id: number; position: number }>> {
  if (notebookId) {
    const rows = await executeQuery<Array<{ section_id: number; notebook_id: number; position: number }>>(
      `SELECT section_id, notebook_id, position
       FROM user_section_orders
       WHERE user_id = ? AND notebook_id = ?
       ORDER BY position ASC`,
      [userId, notebookId]
    );
    return rows;
  } else {
    const rows = await executeQuery<Array<{ section_id: number; notebook_id: number; position: number }>>(
      `SELECT section_id, notebook_id, position
       FROM user_section_orders
       WHERE user_id = ?
       ORDER BY notebook_id ASC, position ASC`,
      [userId]
    );
    return rows;
  }
}

export async function updateSectionOrder(
  userId: number,
  notebookId: number,
  sectionIds: number[],
  connection?: Connection
): Promise<void> {
  const conn = connection || await getConnection();
  const shouldRelease = !connection;

  try {
    // Delete existing orders for this user and notebook
    await conn.query(
      'DELETE FROM user_section_orders WHERE user_id = ? AND notebook_id = ?',
      [userId, notebookId]
    );

    // Insert new orders
    if (sectionIds.length > 0) {
      const values = sectionIds.map((sectionId, position) => [
        userId,
        sectionId,
        notebookId,
        position
      ]);

      await conn.query(
        'INSERT INTO user_section_orders (user_id, section_id, notebook_id, position) VALUES ?',
        [values]
      );
    }
  } finally {
    if (shouldRelease) conn.release();
  }
}

/**
 * Page (Note) Ordering Operations
 */

export async function getPageOrder(
  userId: number,
  sectionId?: number | null
): Promise<Array<{ page_id: string; section_id: number | null; position: number }>> {
  // Handle null sectionId (root pages)
  if (sectionId === null || sectionId === undefined) {
    const rows = await executeQuery<Array<{ page_id: string; section_id: number | null; position: number }>>(
      `SELECT page_id, section_id, position
       FROM user_page_orders
       WHERE user_id = ? AND section_id IS NULL
       ORDER BY position ASC`,
      [userId]
    );
    return rows;
  } else {
    const rows = await executeQuery<Array<{ page_id: string; section_id: number | null; position: number }>>(
      `SELECT page_id, section_id, position
       FROM user_page_orders
       WHERE user_id = ? AND section_id = ?
       ORDER BY position ASC`,
      [userId, sectionId]
    );
    return rows;
  }
}

export async function updatePageOrder(
  userId: number,
  sectionId: number | null,
  pageIds: string[],
  connection?: Connection
): Promise<void> {
  const conn = connection || await getConnection();
  const shouldRelease = !connection;

  try {
    // Delete existing orders for this user and section
    if (sectionId === null) {
      await conn.query(
        'DELETE FROM user_page_orders WHERE user_id = ? AND section_id IS NULL',
        [userId]
      );
    } else {
      await conn.query(
        'DELETE FROM user_page_orders WHERE user_id = ? AND section_id = ?',
        [userId, sectionId]
      );
    }

    // Insert new orders
    if (pageIds.length > 0) {
      const values = pageIds.map((pageId, position) => [
        userId,
        pageId,
        sectionId,
        position
      ]);

      await conn.query(
        'INSERT INTO user_page_orders (user_id, page_id, section_id, position) VALUES ?',
        [values]
      );
    }
  } finally {
    if (shouldRelease) conn.release();
  }
}

/**
 * Helper function to add a single item to an order
 */

export async function addNotebookToOrder(
  userId: number,
  notebookId: number,
  position?: number
): Promise<void> {
  const currentOrder = await getNotebookOrder(userId);

  if (!currentOrder.includes(notebookId)) {
    if (position !== undefined && position >= 0 && position <= currentOrder.length) {
      currentOrder.splice(position, 0, notebookId);
    } else {
      currentOrder.push(notebookId);
    }

    await updateNotebookOrder(userId, currentOrder);
  }
}

export async function addSectionToOrder(
  userId: number,
  sectionId: number,
  notebookId: number,
  position?: number
): Promise<void> {
  const currentOrder = await getSectionOrder(userId, notebookId);
  const sectionIds = currentOrder.map(o => o.section_id);

  if (!sectionIds.includes(sectionId)) {
    if (position !== undefined && position >= 0 && position <= sectionIds.length) {
      sectionIds.splice(position, 0, sectionId);
    } else {
      sectionIds.push(sectionId);
    }

    await updateSectionOrder(userId, notebookId, sectionIds);
  }
}

export async function addPageToOrder(
  userId: number,
  pageId: string,
  sectionId: number | null,
  position?: number
): Promise<void> {
  const currentOrder = await getPageOrder(userId, sectionId);
  const pageIds = currentOrder.map(o => o.page_id);

  if (!pageIds.includes(pageId)) {
    if (position !== undefined && position >= 0 && position <= pageIds.length) {
      pageIds.splice(position, 0, pageId);
    } else {
      pageIds.push(pageId);
    }

    await updatePageOrder(userId, sectionId, pageIds);
  }
}

/**
 * Helper function to remove a single item from an order
 */

export async function removeNotebookFromOrder(
  userId: number,
  notebookId: number
): Promise<void> {
  await executeQuery(
    'DELETE FROM user_notebook_orders WHERE user_id = ? AND notebook_id = ?',
    [userId, notebookId]
  );
}

export async function removeSectionFromOrder(
  userId: number,
  sectionId: number
): Promise<void> {
  await executeQuery(
    'DELETE FROM user_section_orders WHERE user_id = ? AND section_id = ?',
    [userId, sectionId]
  );
}

export async function removePageFromOrder(
  userId: number,
  pageId: string
): Promise<void> {
  await executeQuery(
    'DELETE FROM user_page_orders WHERE user_id = ? AND page_id = ?',
    [userId, pageId]
  );
}
