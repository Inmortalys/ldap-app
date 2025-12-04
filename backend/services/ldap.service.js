import ldap from 'ldapjs';
import configService from './config.service.js';

class LdapService {
    constructor() {
        this.client = null;
        this.config = null;
    }

    /**
     * Get domain password policy (maxPwdAge)
     * @returns {Promise<number>} Maximum password age in days
     */
    async getDomainPasswordPolicy() {
        try {
            if (!this.client) {
                await this.connect();
            }

            // Extract domain DN from baseDN or adminDN
            const domainDN = this.config.baseDN || this.extractDomainDN(this.config.adminDN);

            return new Promise((resolve, reject) => {
                const opts = {
                    filter: '(objectClass=domain)',
                    scope: 'base',
                    attributes: ['maxPwdAge'],
                };

                this.client.search(domainDN, opts, (err, res) => {
                    if (err) {
                        console.error('Error querying domain password policy:', err);
                        reject(err);
                        return;
                    }

                    let maxPwdAge = null;

                    res.on('searchEntry', (entry) => {
                        const obj = entry.pojo || entry.object || entry;
                        if (obj.attributes) {
                            obj.attributes.forEach(attr => {
                                if (attr.type.toLowerCase() === 'maxpwdage' && attr.values.length > 0) {
                                    // maxPwdAge is stored as a negative 100-nanosecond interval
                                    const nanoseconds = Math.abs(parseInt(attr.values[0]));
                                    // Convert to days: nanoseconds / 10000 = milliseconds, / 1000 = seconds, / 60 = minutes, / 60 = hours, / 24 = days
                                    maxPwdAge = Math.floor(nanoseconds / 10000 / 1000 / 60 / 60 / 24);
                                }
                            });
                        }
                    });

                    res.on('error', (err) => {
                        console.error('Error in domain policy search:', err);
                        reject(err);
                    });

                    res.on('end', (result) => {
                        if (result.status !== 0) {
                            reject(new Error(`Domain policy query failed with status: ${result.status}`));
                        } else if (maxPwdAge === null) {
                            console.warn('maxPwdAge not found in domain policy, using default 183 days');
                            resolve(183); // Default based on user's domain
                        } else {
                            console.log(`Domain password policy: maxPwdAge = ${maxPwdAge} days`);
                            resolve(maxPwdAge);
                        }
                    });
                });
            });
        } catch (error) {
            console.error('Error getting domain password policy:', error);
            // Return default value instead of throwing
            return 183;
        }
    }

    /**
     * Extract domain DN from a user DN
     * @param {string} dn - Distinguished Name
     * @returns {string} Domain DN
     */
    extractDomainDN(dn) {
        // Extract DC components from DN
        const dcParts = dn.match(/DC=[^,]+/gi);
        return dcParts ? dcParts.join(',') : dn;
    }

    /**
     * Connect to LDAP server with user credentials
     * @param {string} username - Username for LDAP bind
     * @param {string} password - Password for LDAP bind
     * @returns {Promise<ldap.Client>} Connected LDAP client
     */
    async connect(username, password) {
        try {
            // Get config from config service
            this.config = configService.getLdapConfig();

            // Determine protocol based on port
            let ldapUrl;
            if (this.config.server.includes('://')) {
                ldapUrl = `${this.config.server}:${this.config.port}`;
            } else {
                const protocol = this.config.port === 636 ? 'ldaps' : 'ldap';
                ldapUrl = `${protocol}://${this.config.server}:${this.config.port}`;
            }

            return new Promise((resolve, reject) => {
                const client = ldap.createClient({
                    url: ldapUrl,
                    timeout: 5000,
                    connectTimeout: 10000,
                    tlsOptions: {
                        rejectUnauthorized: false // Allow self-signed certs
                    }
                });

                client.on('error', (err) => {
                    console.error('LDAP connection error:', err);
                    reject(err);
                });

                // Construct user DN for bind
                let userDN = username;
                if (!username.includes('DC=') && !username.includes('@')) {
                    // If username doesn't contain DC= or @, try UPN format
                    const domain = this.extractDomainFromDN(this.config.baseDN);
                    userDN = `${username}@${domain}`;
                }

                console.log(`[DEBUG] Binding to LDAP with DN: ${userDN}`);

                // Bind with user credentials
                client.bind(userDN, password, (err) => {
                    if (err) {
                        console.error('LDAP bind error:', err);
                        console.error(`[DEBUG] Failed bind attempt with DN: ${userDN}`);
                        client.unbind();
                        reject(err);
                    } else {
                        console.log(`Successfully connected to LDAP server as ${username}`);
                        resolve(client);
                    }
                });
            });
        } catch (error) {
            console.error('Error connecting to LDAP:', error);
            throw error;
        }
    }

    /**
     * Authenticate user with LDAP credentials
     * @param {string} username - Username (can be sAMAccountName, UPN, or DN)
     * @param {string} password - User password
     * @returns {Promise<Object>} User information if authentication successful
     */
    async authenticateUser(username, password) {
        try {
            // Get config from config service
            if (!this.config) {
                this.config = configService.getLdapConfig();
            }

            // Determine protocol based on port
            let ldapUrl;
            if (this.config.server.includes('://')) {
                ldapUrl = `${this.config.server}:${this.config.port}`;
            } else {
                const protocol = this.config.port === 636 ? 'ldaps' : 'ldap';
                ldapUrl = `${protocol}://${this.config.server}:${this.config.port}`;
            }

            console.log(`Connecting to LDAP: ${ldapUrl}`);

            return new Promise((resolve, reject) => {
                const authClient = ldap.createClient({
                    url: ldapUrl,
                    timeout: 5000,
                    connectTimeout: 10000,
                    tlsOptions: {
                        rejectUnauthorized: false // Allow self-signed certs for internal domains
                    }
                });

                authClient.on('error', (err) => {
                    console.error('LDAP auth connection error:', err);
                    authClient.unbind();
                    reject(err);
                });

                // Construct user DN
                let userDN = username;

                // If username doesn't contain DC= or @, it's probably sAMAccountName
                if (!username.includes('DC=') && !username.includes('@')) {
                    // Try to construct DN from sAMAccountName
                    // First, try UPN format
                    const domain = this.extractDomainFromDN(this.config.baseDN);
                    userDN = `${username}@${domain}`;
                }

                console.log(`Attempting authentication for: ${userDN}`);

                authClient.bind(userDN, password, async (err) => {
                    if (err) {
                        console.error('LDAP authentication failed:', err.message);
                        authClient.unbind();
                        reject(new Error('Invalid credentials'));
                        return;
                    }

                    console.log(`Successfully authenticated user: ${username}`);

                    // Search for user details
                    // Use domain root as search base to ensure we find users in any OU
                    const searchBase = this.extractDomainDN(this.config.baseDN);

                    const searchFilter = username.includes('@') || username.includes('DC=')
                        ? `(userPrincipalName=${username})`
                        : `(sAMAccountName=${username})`;

                    console.log(`Searching for user details in: ${searchBase}`);
                    console.log(`Search filter: ${searchFilter}`);

                    const opts = {
                        filter: searchFilter,
                        scope: 'sub',
                        attributes: ['dn', 'cn', 'sAMAccountName', 'mail', 'memberOf'],
                    };

                    authClient.search(searchBase, opts, (searchErr, searchRes) => {
                        if (searchErr) {
                            console.error('Error searching for user:', searchErr);
                            authClient.unbind();
                            reject(searchErr);
                            return;
                        }

                        let userInfo = null;

                        searchRes.on('searchEntry', (entry) => {
                            const obj = entry.pojo || entry.object || entry;
                            const attrs = {};

                            if (obj.attributes) {
                                obj.attributes.forEach(attr => {
                                    attrs[attr.type.toLowerCase()] = attr.values.length === 1 ? attr.values[0] : attr.values;
                                });
                            }

                            userInfo = {
                                dn: obj.objectName || attrs.dn,
                                cn: attrs.cn || '',
                                sAMAccountName: attrs.samaccountname || username,
                                mail: attrs.mail || '',
                                memberOf: attrs.memberof || [],
                            };
                        });

                        searchRes.on('error', (searchErr) => {
                            console.error('Error in user search:', searchErr);
                            authClient.unbind();
                            reject(searchErr);
                        });

                        searchRes.on('end', () => {
                            authClient.unbind();
                            if (userInfo) {
                                // Validate that user is in allowed OU
                                const allowedOU = 'OU=Valencia,OU=Administradores,DC=ODECGANDIA,DC=ES';
                                const userDN = userInfo.dn.toUpperCase();
                                const allowedOUUpper = allowedOU.toUpperCase();

                                if (!userDN.includes(allowedOUUpper)) {
                                    console.log(`Access denied: User ${username} is not in allowed OU`);
                                    console.log(`User DN: ${userInfo.dn}`);
                                    console.log(`Required OU: ${allowedOU}`);
                                    reject(new Error('Acceso denegado: Solo usuarios de la OU Administradores pueden iniciar sesión'));
                                    return;
                                }

                                console.log(`Access granted: User ${username} is in allowed OU`);
                                resolve(userInfo);
                            } else {
                                reject(new Error('User not found'));
                            }
                        });
                    });
                });
            });
        } catch (error) {
            console.error('Error authenticating user:', error);
            throw error;
        }
    }

    /**
     * Extract domain DN from full DN (e.g., "OU=Users,DC=example,DC=com" -> "DC=example,DC=com")
     * @param {string} dn - Distinguished Name
     * @returns {string} Domain DN
     */
    extractDomainDN(dn) {
        const dcParts = dn.match(/DC=[^,]+/gi);
        if (dcParts) {
            return dcParts.join(',');
        }
        return dn;
    }

    /**
     * Extract domain name from DN
     * @param {string} dn - Distinguished Name
     * @returns {string} Domain name (e.g., "example.com")
     */
    extractDomainFromDN(dn) {
        const dcParts = dn.match(/DC=([^,]+)/gi);
        if (dcParts) {
            return dcParts.map(dc => dc.replace(/DC=/i, '')).join('.');
        }
        return '';
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
     * @param {Object} client - Authenticated LDAP client (optional)
     * @returns {Promise<Array>} Array of user objects
     */
    async searchUsers(searchBase = null, filter = '(objectClass=person)', client = null) {
        try {
            // Use provided client or existing client (if connected)
            const searchClient = client || this.client;

            if (!searchClient) {
                throw new Error('LDAP client not connected');
            }

            // Get config if not loaded
            if (!this.config) {
                this.config = configService.getLdapConfig();
            }

            // If searchBase is explicitly provided, use it (single search)
            if (searchBase) {
                return this.performSearch(searchClient, searchBase, filter);
            }

            // Otherwise, search across all configured search bases
            const searchBases = this.config.searchBases || [this.config.searchBase || this.config.baseDN];

            // Search all bases and aggregate results
            const allUsers = [];
            const seenDNs = new Set(); // Track DNs to avoid duplicates

            for (const base of searchBases) {
                if (!base) continue; // Skip empty bases

                try {
                    const users = await this.performSearch(searchClient, base, filter);

                    // Add users, filtering out duplicates by DN
                    for (const user of users) {
                        if (!seenDNs.has(user.dn)) {
                            seenDNs.add(user.dn);
                            allUsers.push(user);
                        }
                    }
                } catch (error) {
                    console.error(`Error searching in base ${base}:`, error);
                    // Continue with other bases even if one fails
                }
            }

            return allUsers;
        } catch (error) {
            console.error('Error searching users:', error);
            throw error;
        }
    }

    /**
     * Perform LDAP search on a single search base
     * @param {Object} client - LDAP client
     * @param {string} base - Search base DN
     * @param {string} filter - LDAP filter
     * @returns {Promise<Array>} Array of user objects
     */
    performSearch(client, base, filter) {
        return new Promise((resolve, reject) => {
            const users = [];
            const opts = {
                filter: filter,
                scope: 'sub',
                attributes: [
                    'dn',
                    'cn',
                    'sAMAccountName',
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

            client.search(base, opts, (err, res) => {
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
    }

    /**
     * Parse LDAP entry into user object
     * @param {Object} entry - LDAP search entry
     * @returns {Object} Parsed user object
     */
    parseUserEntry(entry) {
        const obj = entry.pojo || entry.object || entry;
        const attrs = {};

        // Convertir atributos a objeto simple
        if (obj.attributes) {
            obj.attributes.forEach(attr => {
                // Manejar atributos con múltiples valores
                if (Array.isArray(attr.values) && attr.values.length > 0) {
                    // Normalize to lowercase to avoid case sensitivity issues
                    attrs[attr.type.toLowerCase()] = attr.values.length === 1 ? attr.values[0] : attr.values;
                }
            });
        }

        console.log('Parsed attributes:', JSON.stringify(attrs, null, 2));

        const user = {
            dn: obj.objectName,
            cn: attrs.cn || '',
            sAMAccountName: attrs.samaccountname,
            sn: attrs.sn || '',
            givenName: attrs.givenname || '',
            mail: attrs.mail || '',
            isLocked: false,
            isDisabled: false,
            lockoutTime: null,
            pwdChangedTime: null,
            pwdExpiryDate: null,
            daysUntilExpiry: null,
        };

        // Check userAccountControl flags (Active Directory)
        if (attrs.useraccountcontrol) {
            const uac = parseInt(attrs.useraccountcontrol);

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
        if (attrs.lockouttime && attrs.lockouttime !== '0') {
            user.isLocked = true;
            user.lockoutTime = this.parseADTimestamp(attrs.lockouttime);
        }

        // Check if account is locked (OpenLDAP)
        if (attrs.pwdaccountlockedtime) {
            user.isLocked = true;
            user.lockoutTime = new Date(attrs.pwdaccountlockedtime);
        }

        // Parse password changed time and calculate expiry (Active Directory)
        if (attrs.pwdlastset && attrs.pwdlastset !== '0') {
            user.pwdChangedTime = this.parseADTimestamp(attrs.pwdlastset);

            // Check DONT_EXPIRE_PASSWORD (0x10000) in userAccountControl
            const uac = attrs.useraccountcontrol ? parseInt(attrs.useraccountcontrol) : 0;
            const passwordNeverExpires = !!(uac & 0x10000);

            if (!passwordNeverExpires) {
                // Use maxPwdAge from domain policy (queried during connect)
                const maxAge = this.config.maxPwdAge || 183; // Fallback to 183 days
                user.pwdExpiryDate = new Date(user.pwdChangedTime.getTime() + maxAge * 24 * 60 * 60 * 1000);
                user.daysUntilExpiry = Math.floor((user.pwdExpiryDate - new Date()) / (24 * 60 * 60 * 1000));
            }
        }

        // Parse password changed time (OpenLDAP)
        if (attrs.pwdchangedtime) {
            user.pwdChangedTime = this.parseGeneralizedTime(attrs.pwdchangedtime);
        }

        // Parse shadow account expiry (Unix/Linux LDAP)
        if (attrs.shadowlastchange && attrs.shadowmax) {
            const lastChange = parseInt(attrs.shadowlastchange);
            const maxDays = parseInt(attrs.shadowmax);
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
     * Get complete domain password policy
     * @returns {Promise<Object>} Password policy object
     */
    async getDomainPasswordPolicyComplete() {
        try {
            if (!this.client) {
                await this.connect();
            }

            const domainDN = this.config.baseDN || this.extractDomainDN(this.config.adminDN);

            return new Promise((resolve, reject) => {
                const opts = {
                    filter: '(objectClass=domain)',
                    scope: 'base',
                    attributes: [
                        'maxPwdAge',
                        'minPwdAge',
                        'minPwdLength',
                        'pwdHistoryLength',
                        'pwdProperties',
                        'lockoutDuration',
                        'lockoutThreshold',
                        'lockOutObservationWindow'
                    ],
                };

                this.client.search(domainDN, opts, (err, res) => {
                    if (err) {
                        console.error('Error querying domain password policy:', err);
                        reject(err);
                        return;
                    }

                    let policy = {
                        minLength: 12,
                        complexityEnabled: true,
                        historyCount: 24,
                        minAge: 2,
                        maxAge: 183,
                        lockoutThreshold: 8,
                        lockoutDuration: 60,
                        lockoutObservationWindow: 30
                    };

                    res.on('searchEntry', (entry) => {
                        const obj = entry.pojo || entry.object || entry;
                        if (obj.attributes) {
                            obj.attributes.forEach(attr => {
                                const attrName = attr.type.toLowerCase();
                                if (attr.values.length > 0) {
                                    switch (attrName) {
                                        case 'minpwdlength':
                                            policy.minLength = parseInt(attr.values[0]);
                                            break;
                                        case 'pwdhistorylength':
                                            policy.historyCount = parseInt(attr.values[0]);
                                            break;
                                        case 'pwdproperties':
                                            // Bit 0 = complexity enabled
                                            policy.complexityEnabled = !!(parseInt(attr.values[0]) & 0x01);
                                            break;
                                        case 'minpwdage':
                                            const minNano = Math.abs(parseInt(attr.values[0]));
                                            policy.minAge = Math.floor(minNano / 10000 / 1000 / 60 / 60 / 24);
                                            break;
                                        case 'maxpwdage':
                                            const maxNano = Math.abs(parseInt(attr.values[0]));
                                            policy.maxAge = Math.floor(maxNano / 10000 / 1000 / 60 / 60 / 24);
                                            break;
                                        case 'lockoutthreshold':
                                            policy.lockoutThreshold = parseInt(attr.values[0]);
                                            break;
                                        case 'lockoutduration':
                                            const lockNano = Math.abs(parseInt(attr.values[0]));
                                            policy.lockoutDuration = Math.floor(lockNano / 10000 / 1000 / 60);
                                            break;
                                        case 'lockoutobservationwindow':
                                            const obsNano = Math.abs(parseInt(attr.values[0]));
                                            policy.lockoutObservationWindow = Math.floor(obsNano / 10000 / 1000 / 60);
                                            break;
                                    }
                                }
                            });
                        }
                    });

                    res.on('error', (err) => {
                        console.error('Error in domain policy search:', err);
                        reject(err);
                    });

                    res.on('end', (result) => {
                        if (result.status !== 0) {
                            reject(new Error(`Domain policy query failed with status: ${result.status}`));
                        } else {
                            console.log('Domain password policy:', policy);
                            resolve(policy);
                        }
                    });
                });
            });
        } catch (error) {
            console.error('Error getting domain password policy:', error);
            // Return default values
            return {
                minLength: 12,
                complexityEnabled: true,
                historyCount: 24,
                minAge: 2,
                maxAge: 183,
                lockoutThreshold: 8,
                lockoutDuration: 60,
                lockoutObservationWindow: 30
            };
        }
    }

    /**
     * Validate password complexity
     * @param {string} password - Password to validate
     * @param {string} username - Username to check against
     * @returns {Object} Validation result with details
     */
    validatePasswordComplexity(password, username) {
        const result = {
            valid: true,
            errors: [],
            requirements: {
                minLength: false,
                hasUppercase: false,
                hasLowercase: false,
                hasNumber: false,
                hasSpecial: false,
                notContainsUsername: false
            }
        };

        // Check minimum length (12 characters)
        if (password.length >= 12) {
            result.requirements.minLength = true;
        } else {
            result.valid = false;
            result.errors.push('La contraseña debe tener al menos 12 caracteres');
        }

        // Check for uppercase
        if (/[A-Z]/.test(password)) {
            result.requirements.hasUppercase = true;
        } else {
            result.valid = false;
            result.errors.push('Debe contener al menos una letra mayúscula');
        }

        // Check for lowercase
        if (/[a-z]/.test(password)) {
            result.requirements.hasLowercase = true;
        } else {
            result.valid = false;
            result.errors.push('Debe contener al menos una letra minúscula');
        }

        // Check for number
        if (/[0-9]/.test(password)) {
            result.requirements.hasNumber = true;
        } else {
            result.valid = false;
            result.errors.push('Debe contener al menos un número');
        }

        // Check for special character
        if (/[^A-Za-z0-9]/.test(password)) {
            result.requirements.hasSpecial = true;
        } else {
            result.valid = false;
            result.errors.push('Debe contener al menos un carácter especial');
        }

        // Check if password contains username
        if (username && password.toLowerCase().includes(username.toLowerCase())) {
            result.valid = false;
            result.errors.push('La contraseña no puede contener el nombre de usuario');
        } else {
            result.requirements.notContainsUsername = true;
        }

        return result;
    }

    /**
     * Change user password in Active Directory
     * @param {string} userDN - Distinguished Name of the user
     * @param {string} newPassword - New password
     * @param {boolean} adminChange - Whether this is an admin-initiated change
     * @returns {Promise<boolean>} True if password change successful
     */
    async changeUserPassword(userDN, newPassword, adminChange = true) {
        try {
            if (!this.client) {
                await this.connect();
            }

            // Get username from DN for validation
            const username = userDN.split(',')[0].split('=')[1];

            // Validate password complexity
            const validation = this.validatePasswordComplexity(newPassword, username);
            if (!validation.valid) {
                throw new Error(`Validación de contraseña fallida: ${validation.errors.join(', ')}`);
            }

            return new Promise((resolve, reject) => {
                // Encode password for Active Directory (UTF-16LE with quotes)
                const encodedPassword = Buffer.from(`"${newPassword}"`, 'utf16le');

                const change = new ldap.Change({
                    operation: 'replace',
                    modification: {
                        type: 'unicodePwd',
                        values: [encodedPassword],
                    },
                });

                this.client.modify(userDN, change, (err) => {
                    if (err) {
                        console.error('Error changing password:', err);
                        reject(err);
                    } else {
                        console.log(`Successfully changed password for user: ${userDN}`);
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.error('Error changing user password:', error);
            throw error;
        }
    }

    /**
     * Change user password using authenticated admin credentials
     * @param {string} userDN - Distinguished Name of the user
     * @param {string} newPassword - New password
     * @param {string} adminUsername - Admin username
     * @param {string} adminPassword - Admin password
     * @returns {Promise<boolean>} True if password change successful
     */
    async changeUserPasswordWithAuth(userDN, newPassword, adminUsername, adminPassword) {
        try {
            // Get username from DN for validation
            const username = userDN.split(',')[0].split('=')[1];

            // Validate password complexity
            const validation = this.validatePasswordComplexity(newPassword, username);
            if (!validation.valid) {
                throw new Error(`Validación de contraseña fallida: ${validation.errors.join(', ')}`);
            }

            // Connect with admin credentials
            console.log(`[DEBUG] Attempting admin connection with username: ${adminUsername}`);
            const adminClient = await this.connect(adminUsername, adminPassword);

            return new Promise((resolve, reject) => {
                // Encode password for Active Directory (UTF-16LE with quotes)
                const encodedPassword = Buffer.from(`"${newPassword}"`, 'utf16le');

                const change = new ldap.Change({
                    operation: 'replace',
                    modification: {
                        type: 'unicodePwd',
                        values: [encodedPassword],
                    },
                });

                adminClient.modify(userDN, change, (err) => {
                    adminClient.unbind();

                    if (err) {
                        console.error('Error changing password:', err);
                        reject(err);
                    } else {
                        console.log(`Successfully changed password for user: ${userDN} by admin: ${adminUsername}`);
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.error('Error changing user password with auth:', error);
            throw error;
        }
    }

    /**
     * Change user password using configured admin credentials (for token reset)
     * @param {string} userDN - Distinguished Name of the user
     * @param {string} newPassword - New password
     * @returns {Promise<boolean>} True if password change successful
     */
    async adminResetPassword(userDN, newPassword) {
        try {
            // Get admin credentials from config
            const config = configService.getLdapConfig();
            const adminDN = config.adminDN;
            const adminPassword = config.adminPassword;

            if (!adminDN || !adminPassword) {
                const missing = [];
                if (!adminDN) missing.push('LDAP_ADMIN_DN');
                if (!adminPassword) missing.push('LDAP_ADMIN_PASSWORD');
                throw new Error(`Admin credentials not configured. Missing environment variables: ${missing.join(', ')}. Please add them to your .env file.`);
            }

            // Use existing method with admin credentials
            // Note: We pass adminDN as username because connect() handles it
            return await this.changeUserPasswordWithAuth(userDN, newPassword, adminDN, adminPassword);
        } catch (error) {
            console.error('Error in admin reset password:', error);
            throw error;
        }
    }

    /**
     * Unlock a locked user account
     * @param {string} userDN - Distinguished Name of the user
     * @param {string} username - Username for authentication
     * @param {string} password - Password for authentication
     * @returns {Promise<boolean>} True if unlock successful
     */
    async unlockUser(userDN, username, password) {
        try {
            if (!this.client) {
                this.client = await this.connect(username, password);
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
