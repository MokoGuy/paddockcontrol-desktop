export namespace logger {
	
	export class LogFileInfo {
	    currentLogSize: number;
	    rotatedLogCount: number;
	    totalLogsSize: number;
	    oldestLogDate?: number;
	    logsDirectory: string;
	
	    static createFrom(source: any = {}) {
	        return new LogFileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentLogSize = source["currentLogSize"];
	        this.rotatedLogCount = source["rotatedLogCount"];
	        this.totalLogsSize = source["totalLogsSize"];
	        this.oldestLogDate = source["oldestLogDate"];
	        this.logsDirectory = source["logsDirectory"];
	    }
	}

}

export namespace models {
	
	export class BackupCertificate {
	    hostname: string;
	    encrypted_private_key?: number[];
	    pending_csr_pem?: string;
	    certificate_pem?: string;
	    pending_encrypted_private_key?: number[];
	    created_at: number;
	    expires_at?: number;
	    note?: string;
	    pending_note?: string;
	    read_only: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BackupCertificate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.encrypted_private_key = source["encrypted_private_key"];
	        this.pending_csr_pem = source["pending_csr_pem"];
	        this.certificate_pem = source["certificate_pem"];
	        this.pending_encrypted_private_key = source["pending_encrypted_private_key"];
	        this.created_at = source["created_at"];
	        this.expires_at = source["expires_at"];
	        this.note = source["note"];
	        this.pending_note = source["pending_note"];
	        this.read_only = source["read_only"];
	    }
	}
	export class Config {
	    id: number;
	    owner_email: string;
	    ca_name: string;
	    hostname_suffix: string;
	    validity_period_days: number;
	    default_organization: string;
	    default_organizational_unit?: string;
	    default_city: string;
	    default_state: string;
	    default_country: string;
	    default_key_size: number;
	    is_configured: number;
	    created_at: number;
	    last_modified: number;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.owner_email = source["owner_email"];
	        this.ca_name = source["ca_name"];
	        this.hostname_suffix = source["hostname_suffix"];
	        this.validity_period_days = source["validity_period_days"];
	        this.default_organization = source["default_organization"];
	        this.default_organizational_unit = source["default_organizational_unit"];
	        this.default_city = source["default_city"];
	        this.default_state = source["default_state"];
	        this.default_country = source["default_country"];
	        this.default_key_size = source["default_key_size"];
	        this.is_configured = source["is_configured"];
	        this.created_at = source["created_at"];
	        this.last_modified = source["last_modified"];
	    }
	}
	export class BackupData {
	    version: string;
	    exported_at: number;
	    encryption_key?: string;
	    config?: Config;
	    certificates?: BackupCertificate[];
	
	    static createFrom(source: any = {}) {
	        return new BackupData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.exported_at = source["exported_at"];
	        this.encryption_key = source["encryption_key"];
	        this.config = this.convertValues(source["config"], Config);
	        this.certificates = this.convertValues(source["certificates"], BackupCertificate);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BackupValidationResult {
	    valid: boolean;
	    version: string;
	    certificate_count: number;
	    has_encrypted_keys: boolean;
	    has_encryption_key: boolean;
	    encryption_key: string;
	    exported_at: number;
	
	    static createFrom(source: any = {}) {
	        return new BackupValidationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.valid = source["valid"];
	        this.version = source["version"];
	        this.certificate_count = source["certificate_count"];
	        this.has_encrypted_keys = source["has_encrypted_keys"];
	        this.has_encryption_key = source["has_encryption_key"];
	        this.encryption_key = source["encryption_key"];
	        this.exported_at = source["exported_at"];
	    }
	}
	export class SANEntry {
	    value: string;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new SANEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.value = source["value"];
	        this.type = source["type"];
	    }
	}
	export class CSRRequest {
	    hostname: string;
	    sans?: SANEntry[];
	    organization: string;
	    organizational_unit?: string;
	    city: string;
	    state: string;
	    country: string;
	    key_size: number;
	    note?: string;
	    is_renewal?: boolean;
	    skip_suffix_validation?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CSRRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.sans = this.convertValues(source["sans"], SANEntry);
	        this.organization = source["organization"];
	        this.organizational_unit = source["organizational_unit"];
	        this.city = source["city"];
	        this.state = source["state"];
	        this.country = source["country"];
	        this.key_size = source["key_size"];
	        this.note = source["note"];
	        this.is_renewal = source["is_renewal"];
	        this.skip_suffix_validation = source["skip_suffix_validation"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CSRResponse {
	    hostname: string;
	    csr: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new CSRResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.csr = source["csr"];
	        this.message = source["message"];
	    }
	}
	export class Certificate {
	    hostname: string;
	    pending_csr?: string;
	    certificate_pem?: string;
	    created_at: number;
	    expires_at?: number;
	    note?: string;
	    pending_note?: string;
	    read_only: boolean;
	    status: string;
	    sans?: string[];
	    organization?: string;
	    organizational_unit?: string;
	    city?: string;
	    state?: string;
	    country?: string;
	    key_size?: number;
	    days_until_expiration?: number;
	    pending_sans?: string[];
	    pending_organization?: string;
	    pending_organizational_unit?: string;
	    pending_city?: string;
	    pending_state?: string;
	    pending_country?: string;
	    pending_key_size?: number;
	
	    static createFrom(source: any = {}) {
	        return new Certificate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.pending_csr = source["pending_csr"];
	        this.certificate_pem = source["certificate_pem"];
	        this.created_at = source["created_at"];
	        this.expires_at = source["expires_at"];
	        this.note = source["note"];
	        this.pending_note = source["pending_note"];
	        this.read_only = source["read_only"];
	        this.status = source["status"];
	        this.sans = source["sans"];
	        this.organization = source["organization"];
	        this.organizational_unit = source["organizational_unit"];
	        this.city = source["city"];
	        this.state = source["state"];
	        this.country = source["country"];
	        this.key_size = source["key_size"];
	        this.days_until_expiration = source["days_until_expiration"];
	        this.pending_sans = source["pending_sans"];
	        this.pending_organization = source["pending_organization"];
	        this.pending_organizational_unit = source["pending_organizational_unit"];
	        this.pending_city = source["pending_city"];
	        this.pending_state = source["pending_state"];
	        this.pending_country = source["pending_country"];
	        this.pending_key_size = source["pending_key_size"];
	    }
	}
	export class CertificateFilter {
	    status?: string;
	    sort_by?: string;
	    sort_order?: string;
	
	    static createFrom(source: any = {}) {
	        return new CertificateFilter(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.sort_by = source["sort_by"];
	        this.sort_order = source["sort_order"];
	    }
	}
	export class CertificateListItem {
	    hostname: string;
	    status: string;
	    sans?: string[];
	    key_size?: number;
	    created_at: number;
	    expires_at?: number;
	    days_until_expiration?: number;
	    read_only: boolean;
	    has_pending_csr: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CertificateListItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.status = source["status"];
	        this.sans = source["sans"];
	        this.key_size = source["key_size"];
	        this.created_at = source["created_at"];
	        this.expires_at = source["expires_at"];
	        this.days_until_expiration = source["days_until_expiration"];
	        this.read_only = source["read_only"];
	        this.has_pending_csr = source["has_pending_csr"];
	    }
	}
	export class CertificateUploadPreview {
	    hostname: string;
	    issuer_cn: string;
	    issuer_o: string;
	    not_before: number;
	    not_after: number;
	    sans?: string[];
	    key_size: number;
	    csr_match: boolean;
	    key_match: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CertificateUploadPreview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.issuer_cn = source["issuer_cn"];
	        this.issuer_o = source["issuer_o"];
	        this.not_before = source["not_before"];
	        this.not_after = source["not_after"];
	        this.sans = source["sans"];
	        this.key_size = source["key_size"];
	        this.csr_match = source["csr_match"];
	        this.key_match = source["key_match"];
	    }
	}
	export class ChainCertificateInfo {
	    subject_cn: string;
	    subject_o: string;
	    issuer_cn: string;
	    issuer_o: string;
	    not_before_timestamp: number;
	    not_after_timestamp: number;
	    serial_number: string;
	    cert_type: string;
	    depth: number;
	    pem?: string;
	
	    static createFrom(source: any = {}) {
	        return new ChainCertificateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.subject_cn = source["subject_cn"];
	        this.subject_o = source["subject_o"];
	        this.issuer_cn = source["issuer_cn"];
	        this.issuer_o = source["issuer_o"];
	        this.not_before_timestamp = source["not_before_timestamp"];
	        this.not_after_timestamp = source["not_after_timestamp"];
	        this.serial_number = source["serial_number"];
	        this.cert_type = source["cert_type"];
	        this.depth = source["depth"];
	        this.pem = source["pem"];
	    }
	}
	
	export class ExportOptions {
	    certificate: boolean;
	    chain: boolean;
	    private_key: boolean;
	    csr: boolean;
	    pending_key: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ExportOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.certificate = source["certificate"];
	        this.chain = source["chain"];
	        this.private_key = source["private_key"];
	        this.csr = source["csr"];
	        this.pending_key = source["pending_key"];
	    }
	}
	export class HistoryEntry {
	    id: number;
	    hostname: string;
	    event_type: string;
	    message: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new HistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.hostname = source["hostname"];
	        this.event_type = source["event_type"];
	        this.message = source["message"];
	        this.created_at = source["created_at"];
	    }
	}
	export class ImportRequest {
	    certificate_pem: string;
	    private_key_pem: string;
	    cert_chain_pem?: string;
	    note?: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.certificate_pem = source["certificate_pem"];
	        this.private_key_pem = source["private_key_pem"];
	        this.cert_chain_pem = source["cert_chain_pem"];
	        this.note = source["note"];
	    }
	}
	export class KeyValidationResult {
	    valid: boolean;
	    failed_hostnames?: string[];
	
	    static createFrom(source: any = {}) {
	        return new KeyValidationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.valid = source["valid"];
	        this.failed_hostnames = source["failed_hostnames"];
	    }
	}
	export class LocalBackupInfo {
	    filename: string;
	    type: string;
	    timestamp: number;
	    size: number;
	    certificate_count: number;
	    ca_name?: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalBackupInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.type = source["type"];
	        this.timestamp = source["timestamp"];
	        this.size = source["size"];
	        this.certificate_count = source["certificate_count"];
	        this.ca_name = source["ca_name"];
	    }
	}
	
	export class SetupDefaults {
	    validity_period_days: number;
	    default_key_size: number;
	    default_country: string;
	    default_organization: string;
	    default_organizational_unit?: string;
	    default_city: string;
	    default_state: string;
	
	    static createFrom(source: any = {}) {
	        return new SetupDefaults(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.validity_period_days = source["validity_period_days"];
	        this.default_key_size = source["default_key_size"];
	        this.default_country = source["default_country"];
	        this.default_organization = source["default_organization"];
	        this.default_organizational_unit = source["default_organizational_unit"];
	        this.default_city = source["default_city"];
	        this.default_state = source["default_state"];
	    }
	}
	export class SetupRequest {
	    owner_email: string;
	    ca_name: string;
	    hostname_suffix: string;
	    validity_period_days: number;
	    default_organization: string;
	    default_organizational_unit?: string;
	    default_city: string;
	    default_state: string;
	    default_country: string;
	    default_key_size: number;
	
	    static createFrom(source: any = {}) {
	        return new SetupRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.owner_email = source["owner_email"];
	        this.ca_name = source["ca_name"];
	        this.hostname_suffix = source["hostname_suffix"];
	        this.validity_period_days = source["validity_period_days"];
	        this.default_organization = source["default_organization"];
	        this.default_organizational_unit = source["default_organizational_unit"];
	        this.default_city = source["default_city"];
	        this.default_state = source["default_state"];
	        this.default_country = source["default_country"];
	        this.default_key_size = source["default_key_size"];
	    }
	}
	export class UpdateConfigRequest {
	    owner_email: string;
	    ca_name: string;
	    hostname_suffix: string;
	    validity_period_days: number;
	    default_organization: string;
	    default_organizational_unit?: string;
	    default_city: string;
	    default_state: string;
	    default_country: string;
	    default_key_size: number;
	
	    static createFrom(source: any = {}) {
	        return new UpdateConfigRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.owner_email = source["owner_email"];
	        this.ca_name = source["ca_name"];
	        this.hostname_suffix = source["hostname_suffix"];
	        this.validity_period_days = source["validity_period_days"];
	        this.default_organization = source["default_organization"];
	        this.default_organizational_unit = source["default_organizational_unit"];
	        this.default_city = source["default_city"];
	        this.default_state = source["default_state"];
	        this.default_country = source["default_country"];
	        this.default_key_size = source["default_key_size"];
	    }
	}
	export class UpdateHistoryEntry {
	    id: number;
	    from_version: string;
	    to_version: string;
	    status: string;
	    error_message?: string;
	    created_at: number;
	
	    static createFrom(source: any = {}) {
	        return new UpdateHistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.from_version = source["from_version"];
	        this.to_version = source["to_version"];
	        this.status = source["status"];
	        this.error_message = source["error_message"];
	        this.created_at = source["created_at"];
	    }
	}
	export class UpdateInfo {
	    current_version: string;
	    latest_version: string;
	    release_url: string;
	    release_notes: string;
	    published_at: string;
	    asset_size: number;
	    update_available: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.current_version = source["current_version"];
	        this.latest_version = source["latest_version"];
	        this.release_url = source["release_url"];
	        this.release_notes = source["release_notes"];
	        this.published_at = source["published_at"];
	        this.asset_size = source["asset_size"];
	        this.update_available = source["update_available"];
	    }
	}

}

