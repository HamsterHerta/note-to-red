import * as htmlToImage from 'html-to-image';
import JSZip from 'jszip';

export class DownloadManager {
    // 添加共用的导出配置方法
    private static getExportConfig(imageElement: HTMLElement) {
        return {
            quality: 1,
            pixelRatio: 4,
            skipFonts: false,
            // 添加过滤器，确保所有元素都被包含
            filter: (node: Node) => {
                return true;
            },
            // 处理图片加载错误
            imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        };
    }

    static async downloadAllImages(
        element: HTMLElement,
        coverExportSettings?: any
    ): Promise<void> {
        try {
            const zip = new JSZip();
            const previewContainer = element.querySelector('.red-preview-container');
            if (!previewContainer) throw new Error('找不到预览容器');

            // 定义 CSS 类名常量
            const VISIBLE_CLASS = 'red-section-visible';
            const HIDDEN_CLASS = 'red-section-hidden';

            const sections = previewContainer.querySelectorAll<HTMLElement>('.red-content-section');
            const totalSections = sections.length;
            let exportedIndex = 0;

            // 保存原始可见状态（基于类名）
            const originalVisibility = Array.from(sections).map(section => ({
                visible: section.classList.contains(VISIBLE_CLASS),
                hidden: section.classList.contains(HIDDEN_CLASS),
                active: section.classList.contains('red-section-active')
            }));

            for (let i = 0; i < totalSections; i++) {
                const isCoverSection = sections[i].classList.contains('red-cover-section');
                const shouldSkipCover = isCoverSection && (!coverExportSettings?.enabled || !coverExportSettings?.includeInBatchExport);
                if (shouldSkipCover) {
                    continue;
                }

                // 使用 classList API 批量操作
                sections.forEach(section => {
                    section.classList.add(HIDDEN_CLASS);
                    section.classList.remove(VISIBLE_CLASS);
                    section.classList.remove('red-section-active');
                });

                sections[i].classList.remove(HIDDEN_CLASS);
                sections[i].classList.add(VISIBLE_CLASS);
                sections[i].classList.add('red-section-active');

                // 确保浏览器完成重绘并等待资源加载
                await new Promise(resolve => setTimeout(resolve, 300));

                const imageElement = element.querySelector<HTMLElement>('.red-image-preview')!;

                try {
                    const blob = await htmlToImage.toBlob(imageElement, this.getExportConfig(imageElement));
                    if (blob instanceof Blob) {
                        if (isCoverSection) {
                            const fileNamePrefix = coverExportSettings?.fileNamePrefix || '小红书封面';
                            zip.file(`${fileNamePrefix}_00.png`, blob);
                        } else {
                            exportedIndex++;
                            zip.file(`小红书笔记_第${exportedIndex}页.png`, blob);
                        }
                    } else {
                        throw new Error('生成的不是有效的 Blob 对象');
                    }
                } catch (err) {
                    console.warn(`第${i + 1}页导出失败，尝试备用方法`, err);
                    try {
                        const canvas = await htmlToImage.toCanvas(imageElement, this.getExportConfig(imageElement));
                        const blob = await new Promise<Blob>((resolve, reject) => {
                            canvas.toBlob((b) => {
                                if (b) {
                                    resolve(b);
                                } else {
                                    reject(new Error('Canvas 转换为 Blob 失败'));
                                }
                            }, 'image/png', 1);
                        });
                        if (isCoverSection) {
                            const fileNamePrefix = coverExportSettings?.fileNamePrefix || '小红书封面';
                            zip.file(`${fileNamePrefix}_00.png`, blob);
                        } else {
                            exportedIndex++;
                            zip.file(`小红书笔记_第${exportedIndex}页.png`, blob);
                        }
                    } catch (canvasErr) {
                        console.error(`第${i + 1}页备用导出也失败`, canvasErr);
                    }
                }
            }

            // 恢复原始类名状态
            sections.forEach((section, index) => {
                section.classList.toggle(VISIBLE_CLASS, originalVisibility[index].visible);
                section.classList.toggle(HIDDEN_CLASS, originalVisibility[index].hidden);
                section.classList.toggle('red-section-active', originalVisibility[index].active);
            });

            // 创建下载
            const content = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: {
                    level: 9
                }
            });

            if (!(content instanceof Blob)) {
                throw new Error('生成的压缩文件不是有效的 Blob 对象');
            }

            const url = URL.createObjectURL(content);
            const link = Object.assign(document.createElement('a'), {
                href: url,
                download: `小红书笔记_${Date.now()}.zip`
            });

            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('导出图片失败:', error);
            throw error;
        }
    }

    static async downloadCoverImage(element: HTMLElement, coverExportSettings?: any): Promise<void> {
        try {
            const previewContainer = element.querySelector('.red-preview-container');
            if (!previewContainer) throw new Error('找不到预览容器');

            const sections = previewContainer.querySelectorAll<HTMLElement>('.red-content-section');
            const coverSection = Array.from(sections).find(section => section.classList.contains('red-cover-section'));
            if (!coverSection) throw new Error('未找到封面页');

            const VISIBLE_CLASS = 'red-section-visible';
            const HIDDEN_CLASS = 'red-section-hidden';
            const originalVisibility = Array.from(sections).map(section => ({
                visible: section.classList.contains(VISIBLE_CLASS),
                hidden: section.classList.contains(HIDDEN_CLASS),
                active: section.classList.contains('red-section-active')
            }));
            try {
                sections.forEach(section => {
                    section.classList.add(HIDDEN_CLASS);
                    section.classList.remove(VISIBLE_CLASS);
                    section.classList.remove('red-section-active');
                });
                coverSection.classList.remove(HIDDEN_CLASS);
                coverSection.classList.add(VISIBLE_CLASS);
                coverSection.classList.add('red-section-active');

                await new Promise(resolve => setTimeout(resolve, 300));
                const imageElement = element.querySelector<HTMLElement>('.red-image-preview');
                if (!imageElement) throw new Error('找不到预览区域');

                let blob = await htmlToImage.toBlob(imageElement, this.getExportConfig(imageElement));
                if (!(blob instanceof Blob)) {
                    const canvas = await htmlToImage.toCanvas(imageElement, this.getExportConfig(imageElement));
                    blob = await new Promise<Blob>((resolve, reject) => {
                        canvas.toBlob((b) => {
                            if (b) resolve(b);
                            else reject(new Error('Canvas 转换为 Blob 失败'));
                        }, 'image/png', 1);
                    });
                }

                const fileNamePrefix = coverExportSettings?.fileNamePrefix || '小红书封面';
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${fileNamePrefix}_${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } finally {
                sections.forEach((section, index) => {
                    section.classList.toggle(VISIBLE_CLASS, originalVisibility[index].visible);
                    section.classList.toggle(HIDDEN_CLASS, originalVisibility[index].hidden);
                    section.classList.toggle('red-section-active', originalVisibility[index].active);
                });
            }
        } catch (error) {
            console.error('导出封面失败:', error);
            throw error;
        }
    }

    static async downloadSingleImage(element: HTMLElement): Promise<void> {
        try {
            const imageElement = element.querySelector('.red-image-preview') as HTMLElement;
            if (!imageElement) {
                throw new Error('找不到预览区域');
            }

            // 确保浏览器完成重绘并等待资源加载
            await new Promise(resolve => setTimeout(resolve, 300));

            try {
                // 使用 html-to-image 替代 dom-to-image
                const blob = await htmlToImage.toBlob(imageElement, this.getExportConfig(imageElement));

                // 创建下载链接并触发下载
                if (!blob) throw new Error('Blob 对象为空');
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `小红书笔记_${new Date().getTime()}.png`;

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } catch (err) {
                console.warn('导出失败，尝试备用方法', err);
                // 备用方法：使用 toCanvas 然后转换为 blob
                const canvas = await htmlToImage.toCanvas(imageElement, this.getExportConfig(imageElement));
                canvas.toBlob((blob) => {
                    if (!blob) {
                        throw new Error('Canvas 转换为 Blob 失败');
                    }
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `小红书笔记_${new Date().getTime()}.png`;

                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 'image/png', 1);
            }
        } catch (error) {
            console.error('导出图片失败:', error);
            throw error;
        }
    }
}
