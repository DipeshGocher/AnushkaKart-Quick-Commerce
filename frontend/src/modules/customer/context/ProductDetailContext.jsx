import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { customerApi } from '../services/customerApi';
import { useLocation as useAppLocation } from './LocationContext';

const ProductDetailContext = createContext();

export const useProductDetail = () => {
    const context = useContext(ProductDetailContext);
    if (!context) {
        return {
            selectedProduct: null,
            isOpen: false,
            isLoading: false,
            error: null,
            openProduct: () => {},
            closeProduct: () => {}
        };
    }
    return context;
};

const productSummaryCache = new Map();

export const ProductDetailProvider = ({ children }) => {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();

    const { currentLocation } = useAppLocation();

    useEffect(() => {
        const productParam = searchParams.get('product');
        if (productParam) {
            const currentIdOrSlug = selectedProduct?.slug || selectedProduct?._id || selectedProduct?.id;
            if (currentIdOrSlug !== productParam) {
                // Check if already in cache for instant display
                if (productSummaryCache.has(productParam)) {
                    setSelectedProduct(productSummaryCache.get(productParam));
                    setIsOpen(true);
                }

                const params = {};
                if (currentLocation?.latitude && currentLocation?.longitude) {
                    params.lat = currentLocation.latitude;
                    params.lng = currentLocation.longitude;
                }

                setIsLoading(!productSummaryCache.has(productParam));
                setError(null);

                customerApi.getProductById(productParam, params)
                    .then(res => {
                        if (res.data?.success) {
                            const p = res.data.result || res.data.results || res.data.data || res.data;
                            if (p) {
                                const pid = p._id || p.id;
                                if (pid) productSummaryCache.set(String(pid), p);
                                if (p.slug) productSummaryCache.set(String(p.slug), p);
                                setSelectedProduct(p);
                                setIsOpen(true);
                                setError(null);
                            }
                        }
                    })
                    .catch(err => {
                        console.error("Failed to fetch product from URL", err);
                        setError(err.response?.data?.message || "Failed to load product");
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });
            }
        } else if (!productParam && isOpen) {
            setIsOpen(false);
            setTimeout(() => {
                setSelectedProduct(null);
                setError(null);
            }, 300);
        }
    }, [searchParams.get('product'), currentLocation?.latitude, currentLocation?.longitude]);

    const openProduct = (product) => {
        if (!product) return;
        const pid = product._id || product.id;
        const slug = product.slug;
        if (pid) productSummaryCache.set(String(pid), product);
        if (slug) productSummaryCache.set(String(slug), product);

        setSelectedProduct(product);
        setIsOpen(true);
        const idOrSlug = slug || pid;
        if (idOrSlug) {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('product', idOrSlug);
                return next;
            }, { replace: false });
        }
    };

    const closeProduct = () => {
        setIsOpen(false);
        setTimeout(() => {
            setSelectedProduct(null);
            setError(null);
        }, 300);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('product');
            return next;
        }, { replace: true });
    };

    const value = useMemo(
        () => ({ selectedProduct, isOpen, isLoading, error, openProduct, closeProduct }),
        [selectedProduct, isOpen, isLoading, error]
    );

    return (
        <ProductDetailContext.Provider value={value}>
            {children}
        </ProductDetailContext.Provider>
    );
};
