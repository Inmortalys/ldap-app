import PocketBase from 'pocketbase';

class PocketBaseService {
  constructor() {
    this.pb = new PocketBase(process.env.POCKETBASE_URL || 'https://pocketbase.tailsoca.duckdns.org');
  }

  /**
   * Get LDAP configuration from PocketBase
   * @returns {Promise<Object>} LDAP configuration object
   */
  async getLdapConfig() {
    try {
      // Get the first (and should be only) LDAP config record
      const records = await this.pb.collection('ldap_config').getFullList({
        sort: '-created',
      });

      if (records.length === 0) {
        throw new Error('No LDAP configuration found. Please configure LDAP settings first.');
      }

      return records[0];
    } catch (error) {
      console.error('Error fetching LDAP config from PocketBase:', error);
      throw error;
    }
  }

  /**
   * Save or update LDAP configuration
   * @param {Object} config - LDAP configuration object
   * @returns {Promise<Object>} Saved configuration
   */
  async saveLdapConfig(config) {
    try {
      const records = await this.pb.collection('ldap_config').getFullList();

      if (records.length > 0) {
        // Update existing config
        return await this.pb.collection('ldap_config').update(records[0].id, config);
      } else {
        // Create new config
        return await this.pb.collection('ldap_config').create(config);
      }
    } catch (error) {
      console.error('Error saving LDAP config to PocketBase:', error);
      throw error;
    }
  }

  /**
   * Log an audit event
   * @param {string} userId - User ID from PocketBase
   * @param {string} action - Action performed
   * @param {string} target - Target DN or resource
   * @param {Object} details - Additional details
   */
  async logAudit(userId, action, target, details = {}) {
    try {
      await this.pb.collection('audit_logs').create({
        user: userId,
        action,
        target,
        details,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging audit event:', error);
      // Don't throw - audit logging shouldn't break the main operation
    }
  }
}

export default new PocketBaseService();
