package models

// ExportOptions specifies which items to include in a certificate ZIP export
type ExportOptions struct {
	Certificate bool `json:"certificate"`
	Chain       bool `json:"chain"`
	PrivateKey  bool `json:"private_key"`
	CSR         bool `json:"csr"`
	PendingKey  bool `json:"pending_key"`
}
