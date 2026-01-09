import { useEffect, useRef } from "react";
import { motion } from "motion/react";

interface MatrixRainProps {
    duration?: number;
    onComplete?: () => void;
}

export function MatrixRain({ duration = 1200, onComplete }: MatrixRainProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set canvas size to parent container size
        const parent = canvas.parentElement;
        if (!parent) return;

        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;

        // Matrix characters - mix of katakana, latin, numbers, symbols
        const chars =
            "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?";
        const fontSize = 14;
        const columns = Math.floor(canvas.width / fontSize);
        const drops: number[] = [];

        // Initialize drops at random positions
        for (let i = 0; i < columns; i++) {
            drops[i] = Math.random() * -100;
        }

        let animationFrameId: number;
        const startTime = Date.now();

        function draw() {
            if (!ctx || !canvas) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Fade effect - creates the trail
            // Use lighter fade for better visibility
            ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Red color gradient based on progress
            const opacity = progress < 0.5 ? progress * 2 : (1 - progress) * 2;

            // Draw characters
            for (let i = 0; i < drops.length; i++) {
                // Random character
                const char = chars[Math.floor(Math.random() * chars.length)];

                // Red color with varying intensity
                const brightness = Math.random();
                const red = Math.floor(150 + brightness * 105); // 150-255
                ctx.fillStyle = `rgba(${red}, 0, 0, ${opacity * (0.5 + brightness * 0.5)})`;

                // Brighter leading character
                if (Math.random() > 0.975) {
                    ctx.fillStyle = `rgba(255, 100, 100, ${opacity})`;
                }

                ctx.font = `${fontSize}px monospace`;
                ctx.fillText(char, i * fontSize, drops[i] * fontSize);

                // Reset drop to top randomly or when it reaches bottom
                if (
                    drops[i] * fontSize > canvas.height &&
                    Math.random() > 0.975
                ) {
                    drops[i] = 0;
                }

                // Move drop down
                drops[i]++;
            }

            // Continue animation
            if (progress < 1) {
                animationFrameId = requestAnimationFrame(draw);
            } else {
                onComplete?.();
            }
        }

        // Start animation
        animationFrameId = requestAnimationFrame(draw);

        // Cleanup
        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [duration, onComplete]);

    return (
        <motion.div
            className="absolute inset-0 z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            <canvas
                ref={canvasRef}
                className="w-full h-full bg-black/20 dark:bg-black/30"
            />
        </motion.div>
    );
}
