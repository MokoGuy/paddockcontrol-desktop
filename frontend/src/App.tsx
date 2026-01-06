import { useState, useEffect } from "react";
import logo from "@/assets/images/logo-universal.png";
import "@/index.css";
import { GetBuildInfo } from "../wailsjs/go/main/App";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

function App() {
    const [buildInfo, setBuildInfo] = useState<Record<string, string> | null>(
        null,
    );
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadBuildInfo() {
            try {
                const info = await GetBuildInfo();
                setBuildInfo(info);
            } catch (err) {
                setError(`Failed to load build info: ${err}`);
            } finally {
                setIsLoading(false);
            }
        }
        loadBuildInfo();
    }, []);

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-2xl space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <img
                        src={logo}
                        className="w-32 h-32 object-contain mx-auto drop-shadow-lg hover:scale-105 transition-transform"
                        alt="PaddockControl Logo"
                    />
                    <div className="space-y-2">
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                            PaddockControl Desktop
                        </h1>
                        <p className="text-slate-600 text-lg">
                            Phase 3: Wails Integration Complete ✅
                        </p>
                    </div>
                </div>

                {/* Status Card */}
                <Card className="shadow-xl border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-2xl">
                            Backend Status
                        </CardTitle>
                        <CardDescription>
                            All 18 Wails methods bound and ready for frontend
                            development
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {isLoading ? (
                            <div className="text-center py-6">
                                <p className="text-slate-600">
                                    Loading build information...
                                </p>
                            </div>
                        ) : error ? (
                            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                <p className="text-red-700 font-medium">
                                    {error}
                                </p>
                            </div>
                        ) : buildInfo ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-xs text-slate-600 uppercase font-semibold">
                                            Version
                                        </p>
                                        <p className="text-lg font-mono font-bold text-slate-900">
                                            {buildInfo.version}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-xs text-slate-600 uppercase font-semibold">
                                            Go Version
                                        </p>
                                        <p className="text-lg font-mono font-bold text-slate-900">
                                            {buildInfo.goVersion?.replace(
                                                "go",
                                                "",
                                            ) || "unknown"}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 col-span-2">
                                        <p className="text-xs text-slate-600 uppercase font-semibold">
                                            Build Time
                                        </p>
                                        <p className="text-sm font-mono text-slate-900">
                                            {buildInfo.buildTime}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 col-span-2">
                                        <p className="text-xs text-slate-600 uppercase font-semibold">
                                            Git Commit
                                        </p>
                                        <p className="text-sm font-mono text-slate-900">
                                            {buildInfo.gitCommit}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                {/* Features Card */}
                <Card className="shadow-xl border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-xl">
                            Phase 3 Implementation Complete
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-3">
                                <span className="text-green-600 font-bold">
                                    ✅
                                </span>
                                <div>
                                    <p className="font-semibold text-slate-900">
                                        18 Wails Methods Bound
                                    </p>
                                    <p className="text-slate-600">
                                        All certificate, backup, and setup
                                        operations ready
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-green-600 font-bold">
                                    ✅
                                </span>
                                <div>
                                    <p className="font-semibold text-slate-900">
                                        Encryption Key Management
                                    </p>
                                    <p className="text-slate-600">
                                        Startup prompt, validation, and memory
                                        security
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-green-600 font-bold">
                                    ✅
                                </span>
                                <div>
                                    <p className="font-semibold text-slate-900">
                                        Hybrid Logging System
                                    </p>
                                    <p className="text-slate-600">
                                        Dev: colored stdout | Prod: file with
                                        rotation
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-green-600 font-bold">
                                    ✅
                                </span>
                                <div>
                                    <p className="font-semibold text-slate-900">
                                        Build System
                                    </p>
                                    <p className="text-slate-600">
                                        Version injection, production tags,
                                        Wails packaging
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-green-600 font-bold">
                                    ✅
                                </span>
                                <div>
                                    <p className="font-semibold text-slate-900">
                                        Security & Threading
                                    </p>
                                    <p className="text-slate-600">
                                        Thread-safe, defensive programming,
                                        secure key handling
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Next Steps Card */}
                <Card className="shadow-xl border-blue-200 bg-blue-50">
                    <CardHeader>
                        <CardTitle className="text-lg text-blue-900">
                            Next: Phase 4 - Frontend Development
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-blue-900">
                        <p>React UI implementation for:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>
                                Setup wizard (encryption key + configuration)
                            </li>
                            <li>
                                Dashboard (certificate list, filtering, sorting)
                            </li>
                            <li>Certificate detail view and operations</li>
                            <li>Backup management (export/restore)</li>
                            <li>Error handling and notifications</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center space-y-2">
                    <p className="text-sm text-slate-600">
                        Built with ❤️ using Go + Wails + React + Vite
                    </p>
                    <p className="text-xs text-slate-500">
                        Backend: Fully integrated | Frontend: Ready for Phase 4
                    </p>
                </div>
            </div>
        </div>
    );
}

export default App;
