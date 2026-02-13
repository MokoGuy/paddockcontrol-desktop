package keystore

// Keystore provides OS-native credential storage.
type Keystore interface {
	// Store saves data under the given service and account.
	Store(service, account string, data []byte) error

	// Retrieve reads data stored under the given service and account.
	Retrieve(service, account string) ([]byte, error)

	// Delete removes data stored under the given service and account.
	Delete(service, account string) error

	// Available returns true if the keystore backend is usable on this system.
	Available() bool
}

const (
	// ServiceName is the service identifier stored in the OS keyring.
	ServiceName = "PaddockControl"

	// AccountMasterKey is the account name for the wrapped master key.
	AccountMasterKey = "master-key"
)
