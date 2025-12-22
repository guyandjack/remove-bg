//import des librairies
import { LazyMotion, domAnimation, type Variants } from "motion/react";
import * as m from "motion/react-m";

type LogoPath = {
    d: string;
    fill?: string;
    style?: Record<string, string>;
};

const logoPaths: LogoPath[] = [
    {
        d: "M16.8 0l-2.1 11.8c0 .2-.2.4-.3.6s-.4.3-.6.3c-.2 0-.5 0-.7-.1s-.4-.2-.5-.4L8.4 5.4l-4.2 6.9c-.1.2-.2.3-.4.4s-.4.1-.6.1c-.3 0-.5-.1-.7-.3s-.3-.4-.4-.7L0 0h2.3l1.5 8.3 3.6-5.7c.1-.2.2-.3.4-.4s.4-.1.6-.1.4 0 .6.1.3.2.4.4L13 8.3 14.5 0h2.3z",
        fill: "#010202"
    },
    {
        d: "M2.3 0H0l.7 3.9 2.7 2z",
        fill: "#41BEE0"
    },
    {
        d: "M29.4 5.3c0 .5-.1 1-.2 1.4s-.3.8-.5 1.1-.5.6-.8.8-.5.4-.9.5l-.9.3c-.3.1-.6.1-.9.1H20V7.2h5.2c.3 0 .6-.1.8-.2.2-.1.4-.2.6-.4s.3-.3.4-.5.1-.5.1-.8v-1c0-.3-.1-.6-.2-.8s-.2-.4-.4-.6c-.2-.2-.4-.3-.6-.4s-.5-.1-.8-.1H20c-.3 0-.5.1-.7.2s-.2.4-.2.7v9.4h-2.3V3.2c0-.6.1-1.1.3-1.5s.5-.7.8-1 .7-.4 1-.5.7-.2 1-.2h5.2c.5 0 1 .1 1.4.2s.8.3 1.1.5.6.5.8.8c.2.3.4.6.5.9l.3.9c.1.3.1.6.1.9v1.1z",
        fill: "#010202"
    },
    {
        d: "M20 7.2v2.3h2.6l2.9-2.3z",
        fill: "#41BEE0"
    },
    {
        d: "M19.1 12.6l-2.3-6.8v6.8z",
        fill: "#41BEE0"
    }
];

const AnimatedLogoTinyBlack = () => {
    const svgVariants: Variants = {
        hidden: {
            opacity: 0,
            scale: 0.9
        },
        visible: {
            opacity: 1,
            scale: 1,
            transition: {
                duration: 0.3,
                ease: "easeOut",
                staggerChildren: 0.05,
                delayChildren: 0.1
            }
        }
    };

    const pathVariants: Variants = {
        hidden: {
            pathLength: 0,
            opacity: 0,
            fillOpacity: 0
        },
        visible: (index: number) => ({
            pathLength: 1,
            opacity: 1,
            fillOpacity: 1,
            transition: {
                pathLength: {
                    duration: 0.9,
                    ease: "easeInOut",
                    delay: index * 0.05
                },
                opacity: {
                    duration: 0.2,
                    delay: index * 0.05
                },
                fillOpacity: {
                    duration: 0.3,
                    delay: 0.45 + index * 0.05
                }
            }
        })
    };

    return (
        <div>
            <LazyMotion features={domAnimation}>
                <m.svg
                    xmlns="http://www.w3.org/2000/svg"
                    xmlSpace="preserve"
                    id="Calque_1"
                    x="0"
                    y="0"
                    style={{ enableBackground: "new 0 0 29.4 12.8" }}
                    version="1.1"
                    viewBox="0 0 29.4 12.8"
                    variants={svgVariants}
                    initial="hidden"
                    animate="visible"
                    
                >
                    {logoPaths.map((path, index) => (
                        <m.path
                            key={`${path.d}-${index}`}
                            d={path.d}
                            fill={path.fill}
                            style={path.style}
                            variants={pathVariants}
                            custom={index}
                            stroke={path.fill || path.style?.fill}
                            strokeWidth={0.3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ))}
                </m.svg>
            </LazyMotion>
        </div>
    );
};

export { AnimatedLogoTinyBlack };
