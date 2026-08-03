import { toast } from 'sonner';

interface DownloadCredentialParams {
  nome: string;
  email?: string;
  eventoTitulo?: string;
  codigo: string;
  qrContainerId: string;
}

/**
 * Gera um cartão visual da credencial em um canvas de alta resolução e faz o download em formato PNG.
 */
export async function downloadCredentialImage({
  nome,
  email,
  eventoTitulo,
  codigo,
  qrContainerId,
}: DownloadCredentialParams): Promise<void> {
  try {
    const canvas = document.createElement('canvas');
    const width = 800;
    const height = 1100;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.error('Erro ao inicializar renderização da credencial.');
      return;
    }

    // 1. Fundo do Cartão (Gradiente escuro moderno)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0a111e');
    bgGradient.addColorStop(0.5, '#040914');
    bgGradient.addColorStop(1, '#020610');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Moldura externa e efeito de brilho em degradê
    ctx.lineWidth = 3;
    const borderGradient = ctx.createLinearGradient(0, 0, width, height);
    borderGradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)'); // Esmeralda / Verde do tema
    borderGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    borderGradient.addColorStop(1, 'rgba(16, 185, 129, 0.2)');
    ctx.strokeStyle = borderGradient;
    
    // Desenhar retângulo com cantos arredondados
    const margin = 24;
    const radius = 32;
    drawRoundedRect(ctx, margin, margin, width - margin * 2, height - margin * 2, radius);
    ctx.stroke();

    // 3. Cabeçalho / Branding
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('• OLHAR JOVEM • EVENTEASE •', width / 2, 80);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Credencial de Acesso', width / 2, 130);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '16px sans-serif';
    ctx.fillText('Apresente este comprovante ou QR Code no credenciamento', width / 2, 165);

    // Linha divisória
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 195);
    ctx.lineTo(width - 60, 195);
    ctx.stroke();

    // 4. Bloco de Informações do Participante
    let currentY = 240;

    if (eventoTitulo) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('EVENTO', 70, currentY);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      currentY += 32;
      
      // Quebrar título do evento se for muito longo
      const maxTitleWidth = width - 140;
      const lines = wrapText(ctx, eventoTitulo, maxTitleWidth);
      lines.forEach((line) => {
        ctx.fillText(line, 70, currentY);
        currentY += 30;
      });
      currentY += 15;
    }

    // Participante
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PARTICIPANTE', 70, currentY);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    currentY += 34;
    ctx.fillText(nome, 70, currentY);
    currentY += 20;

    // E-mail (se houver)
    if (email) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('E-MAIL', 70, currentY);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '20px sans-serif';
      currentY += 28;
      ctx.fillText(email, 70, currentY);
      currentY += 20;
    }

    // 5. Caixa Destaque para o Código da Credencial
    currentY += 10;
    const codeBoxY = currentY;
    const codeBoxHeight = 110;
    const codeBoxWidth = width - 120;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    drawRoundedRect(ctx, 60, codeBoxY, codeBoxWidth, codeBoxHeight, 20);
    ctx.fill();

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, 60, codeBoxY, codeBoxWidth, codeBoxHeight, 20);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CÓDIGO DA CREDENCIAL', width / 2, codeBoxY + 36);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 42px monospace';
    ctx.fillText(codigo, width / 2, codeBoxY + 82);

    currentY = codeBoxY + codeBoxHeight + 40;

    // 6. Desenhar QR Code do DOM
    const qrContainer = document.getElementById(qrContainerId);
    const svgElement = qrContainer?.querySelector('svg');

    if (svgElement) {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        // Moldura branca para o QR Code
        const qrBoxSize = 280;
        const qrBoxX = (width - qrBoxSize) / 2;
        const qrBoxY = currentY;

        ctx.fillStyle = '#ffffff';
        drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 24);
        ctx.fill();

        // Desenhar a imagem do QR Code centralizada
        const qrMargin = 20;
        const qrImgSize = qrBoxSize - qrMargin * 2;
        ctx.drawImage(img, qrBoxX + qrMargin, qrBoxY + qrMargin, qrImgSize, qrImgSize);

        URL.revokeObjectURL(svgUrl);

        // Rodapé da imagem
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Validação oficial via QRCode EventEase', width / 2, height - 50);

        // Disparar o download da imagem gerada
        triggerDownload(canvas, `credencial-${codigo.toLowerCase()}.png`);
        toast.success('Credencial baixada com sucesso!');
      };
      img.onerror = () => {
        toast.error('Erro ao converter QR Code para download.');
      };
      img.src = svgUrl;
    } else {
      // Caso o QR Code não esteja disponível no DOM
      triggerDownload(canvas, `credencial-${codigo.toLowerCase()}.png`);
      toast.success('Credencial baixada com sucesso!');
    }
  } catch (error) {
    console.error('Erro ao gerar imagem da credencial:', error);
    toast.error('Não foi possível gerar a credencial para download.');
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

function triggerDownload(canvas: HTMLCanvasElement, filename: string) {
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
