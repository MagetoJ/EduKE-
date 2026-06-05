const express = require('express');
const { query, transaction } = require('../db/connection');

const notificationsRouter = express.Router();
const { authorizeRole } = require('../middleware/auth');

notificationsRouter.get('/notifications', authorizeRole(['admin', 'teacher', 'student', 'parent', 'super_admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const userId = req.user.id;
    const { unread_only } = req.query;

    let sql = 'SELECT * FROM notifications WHERE user_id = $1 AND school_id = $2';
    const params = [userId, schoolId];

    if (unread_only === 'true') {
      sql += ' AND is_read = false';
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';

    const result = await query(sql, params);

    const unreadCount = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND school_id = $2 AND is_read = false',
      [userId, schoolId]
    );

    res.json({
      success: true,
      data: result.rows,
      unreadCount: unreadCount.rows[0].count
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

notificationsRouter.post('/notifications/:id/read', authorizeRole(['admin', 'teacher', 'student', 'parent', 'super_admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2 AND school_id = $3 RETURNING *',
      [id, userId, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

notificationsRouter.post('/notifications/read-all', authorizeRole(['admin', 'teacher', 'student', 'parent', 'super_admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const userId = req.user.id;

    await query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND school_id = $2 AND is_read = false',
      [userId, schoolId]
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
  }
});

notificationsRouter.delete('/notifications/:id', authorizeRole(['admin', 'teacher', 'student', 'parent', 'super_admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 AND school_id = $3 RETURNING *',
      [id, userId, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
});

notificationsRouter.delete('/notifications', authorizeRole(['admin', 'teacher', 'student', 'parent', 'super_admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const userId = req.user.id;

    await query(
      'DELETE FROM notifications WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    res.json({ success: true, message: 'All notifications cleared' });
  } catch (err) {
    console.error('Error clearing notifications:', err);
    res.status(500).json({ success: false, error: 'Failed to clear notifications' });
  }
});

module.exports = notificationsRouter;
