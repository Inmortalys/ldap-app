import ldap from 'ldapjs';
import pocketbaseService from './pocketbase.service.js';

class LdapService {
    constructor() {
        this.client = null;
        this.config = null;
    }

    /**
     * Connect to LDAP server using configuration from PocketBase
     * @returns {Promise<ldap.Client>} Connected LDAP client
     */
    async connect() {
        try {
            // Get config from PocketBase
            this.config = await pocketbaseService.getLdapConfig();

            const ldapUrl = `${this.config.server}:${this.config.port}`;

            return new Promise((resolve, reject) => {
                this.client = ldap.createClient({
                    url: ldapUrl,
                    timeout: 5000,
                    connectTimeout: 10000,
                });

                this.client.on('error', (err) => {
                    console.error('LDAP connection error:', err);
                    reject(err);
                });

                // Bind with admin credentials
                this.client.bind(this.config.adminDN, this.config.adminPassword, (err) => {
                    if (err) {
                        console.error('LDAP bind error:', err);
                        reject(err);
                    } else {
                        console.log('Successfully connected to LDAP server');
                        resolve(this.client);
                    }
                });
            });
        } catch (error) {
            console.error('Error connecting to LDAP:', error);
            throw error;
        }
    }

    /**
     * Test LDAP connection with provided configuration
     * @param {Object} config - LDAP configuration to test
     * @returns {Promise<boolean>} True if connection successful
     */
    async testConnection(config) {
        return new Promise((resolve, reject) => {
            const ldapUrl = `${config.server}:${config.port}`;
            const testClient = ldap.createClient({
                url: ldapUrl,
                timeout: 5000,
                connectTimeout: 10000,
            });

            testClient.on('error', (err) => {
                testClient.unbind();
                reject(err);
            });

            testClient.bind(config.adminDN, config.adminPassword, (err) => {
                if (err) {
                    testClient.unbind();
                    reject(err);
                } else {
                    testClient.unbind();
                    resolve(true);
                }
            });
        });
    }

    /**
     * Search for users in LDAP
     * @param {string} searchBase - Base DN to search from (optional, uses config if not provided)
     * @param {string} filter - LDAP filter (default: objectClass=person)
     * @returns {Promise<Array>} Array of user objects
     */
    async searchUsers(searchBase = null, filter = '(objectClass=person)') {
        try {
            if (!this.client) {
                await this.connect();
            }

            const base = searchBase || this.config.searchBase || this.config.baseDN;

            return new Promise((resolve, reject) => {
                const users = [];
                const opts = {
                    filter: filter,
                    scope: 'sub',
                    attributes: [
                        'dn',
                        'cn',
                        'uid',
                        'sn',
                        'givenName',
                        'mail',
                        'userAccountControl',
                        'pwdChangedTime',
                        'pwdLastSet',
                        'accountExpires',
                        'lockoutTime',
                        'pwdAccountLockedTime',
                        'shadowExpire',
                        'shadowLastChange',
                        'shadowMax',
                    ],
                };

                this.client.search(base, opts, (err, res) => {
                    if (err) {
                        console.error('LDAP search error:', err);
                        reject(err);
                        return;
                    }

                    res.on('searchEntry', (entry) => {
                        const user = this.parseUserEntry(entry);
                        users.push(user);
                    });

                    res.on('error', (err) => {
                        console.error('LDAP search result error:', err);
                        reject(err);
                    });

                    res.on('end', (result) => {
                        if (result.status !== 0) {
                            reject(new Error(`LDAP search failed with status: ${result.status}`));
                        } else {
                            resolve(users);
                        }
                    });
                });
            });
        } catch (error) {
            console.error('Error searching users:', error);
            throw error;
        }
    }

    /**
     * Parse LDAP entry into user object
     * @param {Object} entry - LDAP search entry
     * @returns {Object} Parsed user object
     */
    parseUserEntry(entry) {
        const obj = entry.pojo;
        const attrs = obj.attributes.reduce((acc, attr) => {
            acc[attr.type] = attr.values.length === 1 ? attr.values[0] : attr.values;
            return acc;
        }, {});

        const user = {
            dn: obj.objectName,
            cn: attrs.cn || '',
            uid: attrs.uid || attrs.sAMAccountName || '',
            sn: attrs.sn || '',
            givenName: attrs.givenName || '',
            mail: attrs.mail || '',
            isLocked: false,
            isDisabled: false,
            lockoutTime: null,
            pwdChangedTime: null,
            pwdExpiryDate: null,
            daysUntilExpiry: null,
        };

        // Check userAccountControl flags (Active Directory)
        if (attrs.userAccountControl) {
            const uac = parseInt(attrs.userAccountControl);

            // ACCOUNTDISABLE (0x0002)
            if (uac & 0x0002) {
                user.isDisabled = true;
            }

            // LOCKOUT (0x0010) - Note: This is not always reliable in UAC, better to check lockoutTime
            if (uac & 0x0010) {
                user.isLocked = true;
            }
        }

        // Check if account is locked (Active Directory lockoutTime)
        if (attrs.lockoutTime && attrs.lockoutTime !== '0') {
            user.isLocked = true;
            user.lockoutTime = this.parseADTimestamp(attrs.lockoutTime);
        }

        // Check if account is locked (OpenLDAP)
        if (attrs.pwdAccountLockedTime) {
            user.isLocked = true;
            user.lockoutTime = new Date(attrs.pwdAccountLockedTime);
        }

        // Parse password changed time and calculate expiry (Active Directory)
        if (attrs.pwdLastSet && attrs.pwdLastSet !== '0') {
            user.pwdChangedTime = this.parseADTimestamp(attrs.pwdLastSet);

            // Check DONT_EXPIRE_PASSWORD (0x10000) in userAccountControl
            const uac = attrs.userAccountControl ? parseInt(attrs.userAccountControl) : 0;
            const passwordNeverExpires = !!(uac & 0x10000);

            if (!passwordNeverExpires) {
                // AD default password max age is typically 42 days, but we'll use 90 as a safer default
                const maxAge = 90;
                user.pwdExpiryDate = new Date(user.pwdChangedTime.getTime() + maxAge * 24 * 60 * 60 * 1000);
                user.daysUntilExpiry = Math.floor((user.pwdExpiryDate - new Date()) / (24 * 60 * 60 * 1000));
            }
        }

        // Parse password changed time (OpenLDAP)
        if (attrs.pwdChangedTime) {
            user.pwdChangedTime = this.parseGeneralizedTime(attrs.pwdChangedTime);
        }

        // Parse shadow account expiry (Unix/Linux LDAP)
        if (attrs.shadowLastChange && attrs.shadowMax) {
            const lastChange = parseInt(attrs.shadowLastChange);
            const maxDays = parseInt(attrs.shadowMax);
            const changedDate = new Date(lastChange * 24 * 60 * 60 * 1000);
            user.pwdChangedTime = changedDate;
            user.pwdExpiryDate = new Date(changedDate.getTime() + maxDays * 24 * 60 * 60 * 1000);
            user.daysUntilExpiry = Math.floor((user.pwdExpiryDate - new Date()) / (24 * 60 * 60 * 1000));
        }

        return user;
    }

    /**
     * Parse Active Directory timestamp (100-nanosecond intervals since 1601-01-01)
     * @param {string} timestamp - AD timestamp
     * @returns {Date} JavaScript Date object
     */
    parseADTimestamp(timestamp) {
        const adEpoch = new Date('1601-01-01T00:00:00Z').getTime();
        const milliseconds = parseInt(timestamp) / 10000;
        return new Date(adEpoch + milliseconds);
    }

    /**
     * Parse LDAP Generalized Time format (YYYYMMDDHHmmssZ)
     * @param {string} timestamp - Generalized time string
     * @returns {Date} JavaScript Date object
     */
    parseGeneralizedTime(timestamp) {
        const year = timestamp.substring(0, 4);
        const month = timestamp.substring(4, 6);
        const day = timestamp.substring(6, 8);
        const hour = timestamp.substring(8, 10);
        const minute = timestamp.substring(10, 12);
        const second = timestamp.substring(12, 14);
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    }

    /**
     * Unlock a locked user account
     * @param {string} userDN - Distinguished Name of the user
     * @returns {Promise<boolean>} True if unlock successful
     */
    async unlockUser(userDN) {
        try {
            if (!this.client) {
                await this.connect();
            }

            return new Promise((resolve, reject) => {
                const change = new ldap.Change({
                    operation: 'replace',
                    modification: {
                        type: 'lockoutTime',
                        values: ['0'],
                    },
                });

                this.client.modify(userDN, change, (err) => {
                    if (err) {
                        console.error('Error unlocking user:', err);
                        reject(err);
                    } else {
                        console.log(`Successfully unlocked user: ${userDN}`);
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.error('Error unlocking user:', error);
            throw error;
        }
    }

    /**
     * Disconnect from LDAP server
     */
    disconnect() {
        if (this.client) {
            this.client.unbind((err) => {
                if (err) {
                    console.error('Error disconnecting from LDAP:', err);
                } else {
                    console.log('Disconnected from LDAP server');
                }
            });
            this.client = null;
        }
    }
}

export default new LdapService();
