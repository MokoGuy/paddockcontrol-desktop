import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export function ScrollbarDemo() {
    const longContent = Array.from(
        { length: 30 },
        (_, i) =>
            `Line ${i + 1}: This is sample content to demonstrate scrolling behavior.`,
    ).join("\n");

    const tableData = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        description: `Description for item ${i + 1}`,
        value: (i + 1) * 42, // Deterministic value
    }));

    return (
        <div className="space-y-8 p-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Floating Scrollbar Demo
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Showcase of different scrollbar styles
                </p>
            </div>

            {/* Standard Floating Scrollbar */}
            <Card>
                <CardHeader>
                    <CardTitle>Standard Floating Scrollbar (8px)</CardTitle>
                    <CardDescription>
                        Class:{" "}
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            scrollbar-float
                        </code>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border border-gray-300 dark:border-gray-700 rounded-lg">
                        <pre className="overflow-auto scrollbar-float max-h-48 p-4 text-xs font-mono bg-gray-50 dark:bg-gray-900">
                            {longContent}
                        </pre>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        💡 Best for: Tables, code blocks, main content areas
                    </p>
                </CardContent>
            </Card>

            {/* Thin Floating Scrollbar */}
            <Card>
                <CardHeader>
                    <CardTitle>Thin Floating Scrollbar (4px)</CardTitle>
                    <CardDescription>
                        Class:{" "}
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            scrollbar-float-thin
                        </code>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border border-gray-300 dark:border-gray-700 rounded-lg">
                        <div className="overflow-y-auto scrollbar-float-thin max-h-48 p-4 text-xs bg-gray-50 dark:bg-gray-900">
                            {Array.from({ length: 25 }, (_, i) => (
                                <div
                                    key={i}
                                    className="py-2 px-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                                >
                                    Menu Item {i + 1}
                                </div>
                            ))}
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        💡 Best for: Dropdowns, select menus, compact lists
                    </p>
                </CardContent>
            </Card>

            {/* Auto-hide Floating Scrollbar */}
            <Card>
                <CardHeader>
                    <CardTitle>Auto-hide Floating Scrollbar (8px)</CardTitle>
                    <CardDescription>
                        Class:{" "}
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            scrollbar-float-auto
                        </code>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border border-gray-300 dark:border-gray-700 rounded-lg">
                        <pre className="overflow-auto scrollbar-float-auto max-h-48 p-4 text-xs font-mono bg-gray-50 dark:bg-gray-900">
                            {longContent}
                        </pre>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        💡 Hover over the content to see the scrollbar appear.
                        Best for: Large content areas, full-screen views
                    </p>
                </CardContent>
            </Card>

            {/* Horizontal Scrolling Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Horizontal Scroll (Table)</CardTitle>
                    <CardDescription>
                        Standard scrollbar applied to table container
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto scrollbar-float border border-gray-300 dark:border-gray-700 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                        Name (Very Long Column Header)
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                        Description (Another Long Header)
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                        Value (Extra Wide Column)
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                        Additional Data Column
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                        More Information Here
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {tableData.slice(0, 5).map((row) => (
                                    <tr key={row.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                                            {row.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                                            {row.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                            {row.description}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                                            ${row.value}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                            Additional data {row.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                            More info {row.id}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        💡 Scroll horizontally to see the floating scrollbar
                    </p>
                </CardContent>
            </Card>

            {/* Comparison Grid */}
            <Card>
                <CardHeader>
                    <CardTitle>Side-by-Side Comparison</CardTitle>
                    <CardDescription>
                        All three variants displayed together
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Standard */}
                        <div>
                            <h4 className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">
                                Standard (8px)
                            </h4>
                            <div className="border border-gray-300 dark:border-gray-700 rounded">
                                <div className="overflow-y-auto scrollbar-float h-32 p-2 text-xs bg-gray-50 dark:bg-gray-900">
                                    {Array.from({ length: 20 }, (_, i) => (
                                        <div key={i} className="py-1">
                                            Line {i + 1}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Thin */}
                        <div>
                            <h4 className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">
                                Thin (4px)
                            </h4>
                            <div className="border border-gray-300 dark:border-gray-700 rounded">
                                <div className="overflow-y-auto scrollbar-float-thin h-32 p-2 text-xs bg-gray-50 dark:bg-gray-900">
                                    {Array.from({ length: 20 }, (_, i) => (
                                        <div key={i} className="py-1">
                                            Line {i + 1}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Auto-hide */}
                        <div>
                            <h4 className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">
                                Auto-hide (8px)
                            </h4>
                            <div className="border border-gray-300 dark:border-gray-700 rounded">
                                <div className="overflow-y-auto scrollbar-float-auto h-32 p-2 text-xs bg-gray-50 dark:bg-gray-900">
                                    {Array.from({ length: 20 }, (_, i) => (
                                        <div key={i} className="py-1">
                                            Line {i + 1}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Usage Examples */}
            <Card>
                <CardHeader>
                    <CardTitle>Usage Guidelines</CardTitle>
                    <CardDescription>When to use each variant</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4 text-xs">
                        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
                            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                📏 Standard (scrollbar-float)
                            </h4>
                            <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                                <li>Tables with horizontal scroll</li>
                                <li>Code blocks and pre-formatted text</li>
                                <li>Main content areas</li>
                                <li>Log viewers and consoles</li>
                            </ul>
                        </div>

                        <div className="p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-900 rounded-lg">
                            <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                                🎯 Thin (scrollbar-float-thin)
                            </h4>
                            <ul className="list-disc list-inside space-y-1 text-purple-800 dark:text-purple-200">
                                <li>Dropdown menus</li>
                                <li>Select components</li>
                                <li>Compact navigation lists</li>
                                <li>Popovers with limited space</li>
                            </ul>
                        </div>

                        <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg">
                            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                                ✨ Auto-hide (scrollbar-float-auto)
                            </h4>
                            <ul className="list-disc list-inside space-y-1 text-green-800 dark:text-green-200">
                                <li>Dashboard content areas</li>
                                <li>Large text editors</li>
                                <li>Image galleries</li>
                                <li>
                                    Full-screen views where UI should be minimal
                                </li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
