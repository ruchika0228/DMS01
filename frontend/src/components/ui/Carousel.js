import React, { useState, useEffect, useRef } from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import './Carousel.css';

const Carousel = ({ slides, autoHeight = true, autoRotate = false, rotateInterval = 2000 }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const intervalRef = useRef(null);

    // Auto-rotation effect
    useEffect(() => {
        if (!autoRotate || isPaused) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            return;
        }

        intervalRef.current = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, rotateInterval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [autoRotate, isPaused, rotateInterval, slides.length]);

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
        setIsPaused(true);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
        setIsPaused(true);
    };

    const goToSlide = (index) => {
        setCurrentSlide(index);
        setIsPaused(true);
    };

    const handleMouseEnter = () => {
        if (autoRotate) {
            setIsPaused(true);
        }
    };

    const handleMouseLeave = () => {
        if (autoRotate) {
            setIsPaused(false);
        }
    };

    return (
        <div
            className="carousel"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="carousel-content">
                <div
                    className="carousel-nav-area prev"
                    onClick={prevSlide}
                    role="button"
                    tabIndex="0"
                    aria-label="Previous slide"
                >
                    <IoChevronBack className="nav-icon" />
                </div>

                <div className="carousel-slides">
                    <div
                        className="carousel-track"
                        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                    >
                        {slides.map((slide, index) => (
                            <div key={index} className="carousel-slide">
                                {slide}
                            </div>
                        ))}
                    </div>
                </div>

                <div
                    className="carousel-nav-area next"
                    onClick={nextSlide}
                    role="button"
                    tabIndex="0"
                    aria-label="Next slide"
                >
                    <IoChevronForward className="nav-icon" />
                </div>
            </div>

            <div className="carousel-indicators">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        className={`carousel-dot ${index === currentSlide ? 'active' : ''}`}
                        onClick={() => goToSlide(index)}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default Carousel;