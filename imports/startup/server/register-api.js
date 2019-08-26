/**
 * Register each api
 * import private server methods and server publications
 */

// users api
import '../../api/users/publications.js';
import '../../api/users/hooks.js';

// counters api (example)
import '../../api/counters/methods.js';
import '../../api/counters/publications.js';

// hashes api
import '../../api/hashes/methods.js';
import '../../api/hashes/publications.js';

// aws api
import '../../api/aws/methods.js';
import '../../api/aws/publications.js';
