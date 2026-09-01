"""
Generador del Manual Maestro del Centro de Control Digital R&T SITRAM SAC
Guía Exhaustiva y Práctica Página por Página para el Propietario / Gerencia General.
"""
from __future__ import annotations

import os
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Group, Line, Rect, String, Polygon, Circle
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "Manual_Maestro_Centro_de_Control_Digital_RT_SITRAM.pdf"

# Paleta Andes Operativos
NAVY = colors.HexColor("#12324A")
BLUE = colors.HexColor("#23628B")
TEAL = colors.HexColor("#1F7A78")
ORANGE = colors.HexColor("#C7652A")
GOLD = colors.HexColor("#D49A31")
INK = colors.HexColor("#1F2933")
MUTED = colors.HexColor("#52606D")
PALE = colors.HexColor("#F4F7F9")
PALE_BLUE = colors.HexColor("#E9F2F7")
PALE_ORANGE = colors.HexColor("#FCF3ED")
PALE_GREEN = colors.HexColor("#EAF5F2")
GREEN_ACCENT = colors.HexColor("#1B8A5A")
LINE = colors.HexColor("#D1DCE3")
WHITE = colors.white


def register_fonts() -> None:
    font_path_regular = "C:/Windows/Fonts/arial.ttf"
    font_path_bold = "C:/Windows/Fonts/arialbd.ttf"
    font_path_italic = "C:/Windows/Fonts/ariali.ttf"
    font_path_bolditalic = "C:/Windows/Fonts/arialbi.ttf"

    if os.path.exists(font_path_regular):
        pdfmetrics.registerFont(TTFont("Arial", font_path_regular))
        pdfmetrics.registerFont(TTFont("Arial-Bold", font_path_bold))
        pdfmetrics.registerFont(TTFont("Arial-Italic", font_path_italic))
        pdfmetrics.registerFont(TTFont("Arial-BoldItalic", font_path_bolditalic))
    else:
        # Fallback a fuentes base si no estuvieran en la ruta esperada
        pass


class NumberedCanvas(canvas.Canvas):
    """Canvas de dos pasos para calcular el total exacto de páginas y dibujar encabezado/pie."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        width, height = letter
        if self._pageNumber > 1:
            self.saveState()
            # Encabezado superior
            self.setStrokeColor(LINE)
            self.setLineWidth(0.6)
            self.line(0.65 * inch, height - 0.48 * inch, width - 0.65 * inch, height - 0.48 * inch)

            self.setFillColor(NAVY)
            self.setFont("Arial-Bold", 8)
            self.drawString(0.65 * inch, height - 0.40 * inch, "R&T SITRAM SAC  |  CENTRO DE CONTROL DIGITAL")

            self.setFillColor(MUTED)
            self.setFont("Arial", 7.5)
            self.drawRightString(width - 0.65 * inch, height - 0.40 * inch, "MANUAL MAESTRO DEL DUEÑO")

            # Pie de página inferior
            self.setStrokeColor(LINE)
            self.setLineWidth(0.5)
            self.line(0.65 * inch, 0.48 * inch, width - 0.65 * inch, 0.48 * inch)

            self.setFillColor(MUTED)
            self.setFont("Arial", 7.5)
            self.drawString(0.65 * inch, 0.36 * inch, "Confidencial — Uso exclusivo para la Dirección y Gerencia de R&T SITRAM SAC")
            page_text = f"Página {self._pageNumber} de {page_count}"
            self.drawRightString(width - 0.65 * inch, 0.36 * inch, page_text)
            self.restoreState()


def get_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle(
            "cover_kicker", parent=base["Normal"], fontName="Arial-Bold", fontSize=12,
            leading=15, textColor=GOLD, alignment=TA_CENTER, spaceAfter=14,
        ),
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Normal"], fontName="Arial-Bold", fontSize=28,
            leading=34, textColor=WHITE, alignment=TA_CENTER, spaceAfter=12,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub", parent=base["Normal"], fontName="Arial", fontSize=13,
            leading=18, textColor=colors.HexColor("#DCE7EE"), alignment=TA_CENTER, spaceAfter=8,
        ),
        "cover_tag": ParagraphStyle(
            "cover_tag", parent=base["Normal"], fontName="Arial-Bold", fontSize=10,
            leading=14, textColor=GOLD, alignment=TA_CENTER,
        ),
        "title": ParagraphStyle(
            "title", parent=base["Normal"], fontName="Arial-Bold", fontSize=18, leading=22,
            textColor=NAVY, spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"], fontName="Arial", fontSize=9.5, leading=13.5,
            textColor=MUTED, spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Normal"], fontName="Arial-Bold", fontSize=11, leading=14,
            textColor=BLUE, spaceBefore=5, spaceAfter=3,
        ),
        "h3": ParagraphStyle(
            "h3", parent=base["Normal"], fontName="Arial-Bold", fontSize=9.5, leading=12.5,
            textColor=TEAL, spaceBefore=4, spaceAfter=2,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"], fontName="Arial", fontSize=8.5, leading=11.8,
            textColor=INK, spaceAfter=4, alignment=TA_LEFT,
        ),
        "body_justify": ParagraphStyle(
            "body_justify", parent=base["Normal"], fontName="Arial", fontSize=8.5, leading=11.8,
            textColor=INK, spaceAfter=5, alignment=TA_JUSTIFY,
        ),
        "body_small": ParagraphStyle(
            "body_small", parent=base["Normal"], fontName="Arial", fontSize=7.8, leading=10.5,
            textColor=INK, spaceAfter=2,
        ),
        "label": ParagraphStyle(
            "label", parent=base["Normal"], fontName="Arial-Bold", fontSize=8, leading=10,
            textColor=NAVY, spaceAfter=2,
        ),
        "label_white": ParagraphStyle(
            "label_white", parent=base["Normal"], fontName="Arial-Bold", fontSize=8, leading=10,
            textColor=WHITE,
        ),
        "label_blue": ParagraphStyle(
            "label_blue", parent=base["Normal"], fontName="Arial-Bold", fontSize=8, leading=10,
            textColor=BLUE, spaceAfter=1,
        ),
        "label_orange": ParagraphStyle(
            "label_orange", parent=base["Normal"], fontName="Arial-Bold", fontSize=8, leading=10,
            textColor=ORANGE, spaceAfter=1,
        ),
        "label_green": ParagraphStyle(
            "label_green", parent=base["Normal"], fontName="Arial-Bold", fontSize=8, leading=10,
            textColor=GREEN_ACCENT, spaceAfter=1,
        ),
        "note": ParagraphStyle(
            "note", parent=base["Normal"], fontName="Arial", fontSize=8, leading=11,
            textColor=INK,
        ),
        "example_text": ParagraphStyle(
            "example_text", parent=base["Normal"], fontName="Arial", fontSize=7.8, leading=10.8,
            textColor=INK,
        ),
        "step_bullet": ParagraphStyle(
            "step_bullet", parent=base["Normal"], fontName="Arial", fontSize=8.2, leading=11.2,
            textColor=INK, spaceAfter=2.5,
        ),
    }


def P(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def bullet(text: str, s: dict[str, ParagraphStyle], bullet_color="#C7652A") -> Paragraph:
    return P(f"<font color='{bullet_color}'><b>•</b></font>&nbsp;&nbsp;{text}", s["step_bullet"])


def callout_box(s, title: str, text: str, bg_color=PALE_BLUE, border_color=LINE, title_style="label_blue") -> Table:
    """Caja de llamada destacada para consejos del dueño, alertas o reglas de oro."""
    table = Table([[P(title, s[title_style])], [P(text, s["note"])]], colWidths=[6.8 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg_color),
        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def example_box(s, title: str, content: str) -> Table:
    """Caja de ejemplo práctico con datos reales."""
    formatted_content = f"<b>EJEMPLO REAL:</b> {content}"
    table = Table([[P(f"<b>{title.upper()}</b>", s["label_green"])], [P(formatted_content, s["example_text"])]], colWidths=[6.8 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE_GREEN),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#A8D5C8")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def draw_desktop_wireframe(title: str, blocks: list[tuple[str, str]]) -> Drawing:
    """Dibuja un wireframe vectorial de pantalla de escritorio."""
    width, height = 490, 85
    d = Drawing(width, height)
    # Marco de ventana
    d.add(Rect(0, 0, width, height, fillColor=WHITE, strokeColor=LINE, strokeWidth=0.6, rx=4, ry=4))
    # Barra superior
    d.add(Rect(0, height - 16, width, 16, fillColor=NAVY, strokeColor=NAVY, rx=4, ry=4))
    d.add(String(8, height - 12, "R&T SITRAM  —  Centro de Control Digital", fontName="Arial-Bold", fontSize=6.8, fillColor=WHITE))
    d.add(String(240, height - 12, f"Módulo: {title[:45]}", fontName="Arial", fontSize=6.5, fillColor=colors.HexColor("#D8E4EC")))
    # Menú lateral
    d.add(Rect(0, 0, 75, height - 16, fillColor=PALE, strokeColor=LINE, strokeWidth=0.4))
    navs = ["Inicio", "Viajes", "Flota", "Dinero", "Mantenim.", "GPS"]
    for i, n in enumerate(navs):
        y = height - 28 - i * 9.5
        d.add(String(8, y, f"› {n}", fontName="Arial", fontSize=5.8, fillColor=MUTED))
    # Tarjetas de contenido
    card_w = 195
    usable = blocks[:4]
    for idx, (b_title, b_desc) in enumerate(usable):
        col = idx % 2
        row = idx // 2
        x = 83 + col * 202
        y = height - 42 - row * 24
        bg = PALE_BLUE if idx == 0 else WHITE
        d.add(Rect(x, y, card_w, 20, fillColor=bg, strokeColor=LINE, strokeWidth=0.4, rx=3, ry=3))
        d.add(String(x + 5, y + 12, b_title[:32], fontName="Arial-Bold", fontSize=6.2, fillColor=NAVY))
        d.add(String(x + 5, y + 4, b_desc[:44], fontName="Arial", fontSize=5.3, fillColor=MUTED))
    return d


def draw_mobile_wireframe(title: str, blocks: list[tuple[str, str]]) -> Drawing:
    """Dibuja un wireframe vectorial representando la aplicación PWA móvil del Conductor."""
    width, height = 490, 85
    d = Drawing(width, height)
    # Fondo
    d.add(Rect(0, 0, width, height, fillColor=PALE, strokeColor=LINE, strokeWidth=0.5, rx=4, ry=4))
    # Marco de teléfono móvil al centro
    phone_w, phone_h = 130, 79
    px = 15
    py = 3
    d.add(Rect(px, py, phone_w, phone_h, fillColor=WHITE, strokeColor=NAVY, strokeWidth=0.8, rx=6, ry=6))
    # Barra móvil
    d.add(Rect(px, py + phone_h - 13, phone_w, 13, fillColor=NAVY, strokeColor=NAVY, rx=6, ry=6))
    d.add(String(px + 6, py + phone_h - 9, "R&T Móvil (PWA Conductor)", fontName="Arial-Bold", fontSize=5.5, fillColor=WHITE))
    # Botones móviles
    d.add(Rect(px + 6, py + 46, 56, 16, fillColor=PALE_BLUE, strokeColor=LINE, strokeWidth=0.3, rx=2, ry=2))
    d.add(String(px + 10, py + 56, "Combustible", fontName="Arial-Bold", fontSize=5.2, fillColor=BLUE))
    d.add(String(px + 10, py + 49, "Registrar diésel", fontName="Arial", fontSize=4.5, fillColor=MUTED))

    d.add(Rect(px + 68, py + 46, 56, 16, fillColor=PALE_BLUE, strokeColor=LINE, strokeWidth=0.3, rx=2, ry=2))
    d.add(String(px + 72, py + 56, "Gastos Ruta", fontName="Arial-Bold", fontSize=5.2, fillColor=BLUE))
    d.add(String(px + 72, py + 49, "Peaje / Viático", fontName="Arial", fontSize=4.5, fillColor=MUTED))

    d.add(Rect(px + 6, py + 26, 56, 16, fillColor=PALE_BLUE, strokeColor=LINE, strokeWidth=0.3, rx=2, ry=2))
    d.add(String(px + 10, py + 36, "Kilometraje", fontName="Arial-Bold", fontSize=5.2, fillColor=BLUE))
    d.add(String(px + 10, py + 29, "Foto tablero", fontName="Arial", fontSize=4.5, fillColor=MUTED))

    d.add(Rect(px + 68, py + 26, 56, 16, fillColor=PALE_ORANGE, strokeColor=ORANGE, strokeWidth=0.3, rx=2, ry=2))
    d.add(String(px + 72, py + 36, "Incidencia", fontName="Arial-Bold", fontSize=5.2, fillColor=ORANGE))
    d.add(String(px + 72, py + 29, "Avería / Retraso", fontName="Arial", fontSize=4.5, fillColor=MUTED))

    d.add(Rect(px + 6, py + 6, 118, 16, fillColor=PALE_GREEN, strokeColor=GREEN_ACCENT, strokeWidth=0.4, rx=2, ry=2))
    d.add(String(px + 10, py + 16, "ESTADO: OFFLINE-READY (Funciona sin Internet)", fontName="Arial-Bold", fontSize=5.2, fillColor=GREEN_ACCENT))
    d.add(String(px + 10, py + 9, "Guarda en celular y sincroniza al volver la señal", fontName="Arial", fontSize=4.5, fillColor=MUTED))

    # Lado derecho: Tarjetas descriptivas del módulo
    for idx, (b_title, b_desc) in enumerate(blocks[:3]):
        y_pos = height - 25 - idx * 24
        d.add(Rect(155, y_pos, 325, 20, fillColor=WHITE, strokeColor=LINE, strokeWidth=0.4, rx=3, ry=3))
        d.add(String(162, y_pos + 12, b_title[:45], fontName="Arial-Bold", fontSize=6.5, fillColor=NAVY))
        d.add(String(162, y_pos + 4, b_desc[:70], fontName="Arial", fontSize=5.5, fillColor=MUTED))

    return d


def screen_section_page(
    story: list,
    s: dict[str, ParagraphStyle],
    num_str: str,
    title: str,
    subtitle: str,
    val_owner: str,
    control_points: list[str],
    steps: list[str],
    blocks: list[tuple[str, str]],
    example_text: str,
    what_if_text: str,
    is_mobile: bool = False,
    caution_text: str | None = None,
) -> None:
    """Genera una página completa y exhaustiva para una pantalla del sistema."""
    # Título y subtítulo
    header_title = f"{num_str}. {title}" if num_str else title
    story.append(P(header_title, s["title"]))
    story.append(P(subtitle, s["subtitle"]))

    # Wireframe gráfico
    if is_mobile:
        story.append(draw_mobile_wireframe(title, blocks))
    else:
        story.append(draw_desktop_wireframe(title, blocks))
    story.append(Spacer(1, 4))

    # Valor para el Dueño y Puntos de Control Críticos
    two_col_data = [
        [
            P("<b>¿QUÉ GANA EL DUEÑO CON ESTA PANTALLA?</b>", s["label_blue"]),
            P("<b>PUNTOS DE CONTROL CRÍTICOS (FOCOS ROJOS)</b>", s["label_orange"]),
        ],
        [
            P(val_owner, s["body_small"]),
            P("<br/>".join([f"• {cp}" for cp in control_points]), s["body_small"]),
        ]
    ]
    two_col_table = Table(two_col_data, colWidths=[3.35 * inch, 3.45 * inch])
    two_col_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), PALE_BLUE),
        ("BACKGROUND", (1, 0), (1, 0), PALE_ORANGE),
        ("BACKGROUND", (0, 1), (0, 1), WHITE),
        ("BACKGROUND", (1, 1), (1, 1), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(two_col_table)
    story.append(Spacer(1, 4))

    # Paso a Paso
    story.append(P("<b>CÓMO USAR ESTA PANTALLA — PASO A PASO:</b>", s["label"]))
    for st in steps:
        story.append(bullet(st, s))
    story.append(Spacer(1, 3))

    # Ejemplo Práctico Real
    story.append(example_box(s, f"Caso Real en {title}", example_text))
    story.append(Spacer(1, 3))

    # Qué hacer si... (Excepciones)
    story.append(callout_box(s, "¿QUÉ HACER SI OCURRE UN IMPREVISTO?", what_if_text, bg_color=PALE_BLUE, title_style="label_blue"))

    if caution_text:
        story.append(Spacer(1, 3))
        story.append(callout_box(s, "ATENCIÓN / REGLA DE ORO", caution_text, bg_color=PALE_ORANGE, border_color=ORANGE, title_style="label_orange"))

    story.append(PageBreak())


def generate_manual_pdf() -> None:
    register_fonts()
    s = get_styles()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=0.65 * inch,
        rightMargin=0.65 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.62 * inch,
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="master", frames=[frame])])

    story = []

    # =========================================================================
    # 1. PORTADA EJECUTIVA
    # =========================================================================
    story.append(Spacer(1, 0.4 * inch))
    cover_data = [
        [""],
        [P("DOCUMENTO MAESTRO DE OPERACIÓN Y GESTIÓN", s["cover_kicker"])],
        [P("MANUAL DEL PROPIETARIO<br/>CENTRO DE CONTROL DIGITAL", s["cover_title"])],
        [P("R&T SITRAM SAC — Transporte de Carga Pesada", s["cover_sub"])],
        [""],
        [P("Guía Práctica, Visual y Paso a Paso para Dirigir la Operación,<br/>Controlar el Dinero, Proteger la Flota y Maximizar la Rentabilidad", s["cover_sub"])],
        [""],
        [P("Versión Integral 2.0  |  Agosto de 2026", s["cover_tag"])],
    ]
    cover_table = Table(cover_data, colWidths=[6.8 * inch], rowHeights=[1.1 * inch, None, None, None, 1.2 * inch, None, 1.0 * inch, None])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 24),
        ("RIGHTPADDING", (0, 0), (-1, -1), 24),
    ]))
    story.append(cover_table)
    story.append(PageBreak())

    # =========================================================================
    # 2. PRESENTACIÓN: DE WHATSAPP AL CONTROL TOTAL
    # =========================================================================
    story.append(P("Bienvenida y Filosofía Operativa", s["title"]))
    story.append(P("Cómo este sistema transforma el conocimiento de R&T SITRAM en una operación ordenada, blindada y rentable.", s["subtitle"]))

    story.append(P(
        "Estimado Propietario / Gerente General:<br/>"
        "Durante años, <b>R&T SITRAM SAC</b> ha operado con éxito movilizando carga pesada por todo el Perú. Toda la información crítica —viajes acordados, fotos de guías, vales de combustible, tickets de peaje, transferencias de anticipos y comprobantes de taller— se ha gestionado tradicionalmente a través de grupos de WhatsApp, llamadas y cuadernos de apuntes.<br/><br/>"
        "Si bien WhatsApp es rápido para comunicarse, genera tres grandes dolores de cabeza para la dirección:",
        s["body"]
    ))

    pain_points = [
        "<b>Dinero suelto y rendiciones tardías:</b> Los choferes reciben fondos para viáticos pero las fotos de los comprobantes quedan perdidas en los chats, haciendo casi imposible conciliar el vuelto exacto al terminar el viaje.",
        "<b>Falta de trazabilidad en costos reales:</b> No se sabe con certeza matemática cuánto diésel consumió exactamente un flete o si un mantenimiento preventivo se realizó a tiempo.",
        "<b>Cobranza desfasada:</b> Los fletes terminados demoran en facturarse o cobrarse porque los papeles físicos tardan días en regresar a la oficina.",
    ]
    for pp in pain_points:
        story.append(bullet(pp, s))

    story.append(Spacer(1, 4))
    story.append(callout_box(
        s,
        "LA REGLA FUNDAMENTAL DEL SISTEMA",
        "<b>WhatsApp sigue sirviendo para conversar y avisar urgencias en ruta.</b> Pero <b>TODO HECHO QUE REPRESENTE DINERO, KILOMETRAJE, COMBUSTIBLE O COMPROMISO COMERCIAL</b> se registra en el Centro de Control Digital. De esta forma, cada sol queda justificado y vinculado a su viaje y camión.",
        bg_color=PALE_ORANGE, border_color=ORANGE, title_style="label_orange"
    ))

    story.append(Spacer(1, 6))
    story.append(P("Los 4 Roles del Sistema — Quién hace qué:", s["h2"]))

    roles_data = [
        [P("ROL", s["label_white"]), P("RESPONSABILIDAD PRINCIPAL", s["label_white"]), P("LO QUE DEBE Y NO DEBE HACER", s["label_white"])],
        [
            P("<b>GERENCIA (Dueño)</b>", s["label"]),
            P("Visión 360°, control de rentabilidad, resolución de excepciones, aprobación de odómetros GPS y auditoría financiera.", s["body_small"]),
            P("Supervisa indicadores, aprueba pagos sensibles y revisa rendiciones cerradas. No pierde tiempo en tipeo manual.", s["body_small"]),
        ],
        [
            P("<b>ADMINISTRACIÓN</b>", s["label"]),
            P("Creación y programación de viajes, control de órdenes de trabajo, carga de documentos y pre-liquidación de gastos.", s["body_small"]),
            P("Programa tracto/conductor, revisa vales de diésel y prepara las rendiciones. No puede borrar auditoría.", s["body_small"]),
        ],
        [
            P("<b>CONTABILIDAD</b>", s["label"]),
            P("Control de facturación, detracciones, cobranza de clientes, validación tributaria y conciliación de caja/bancos.", s["body_small"]),
            P("Registra facturas y abonos parciales. Monitorea cuentas por cobrar y no altera etapas operativas de ruta.", s["body_small"]),
        ],
        [
            P("<b>CONDUCTOR (Chofer)</b>", s["label"]),
            P("Ejecución del servicio en carretera usando la PWA móvil en su teléfono (funciona incluso sin señal de internet).", s["body_small"]),
            P("Registra cargas de diésel, peajes, fotos de comprobantes y odómetro. No ve información financiera global.", s["body_small"]),
        ],
    ]
    roles_table = Table(roles_data, colWidths=[1.4 * inch, 2.7 * inch, 2.7 * inch])
    roles_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(roles_table)
    story.append(PageBreak())

    # =========================================================================
    # 3. EL RECORRIDO DE UN SERVICIO (CICLO DE VIDA)
    # =========================================================================
    story.append(P("El Recorrido Completo de un Servicio", s["title"]))
    story.append(P("Mapa paso a paso: desde que el cliente pide una cotización hasta que el dinero ingresa al banco.", s["subtitle"]))

    flow_blocks = [
        [P("1. EVALUAR Y COTIZAR", s["label_white"]), P("2. CREAR Y PROGRAMAR", s["label_white"]), P("3. EJECUTAR EN RUTA", s["label_white"]), P("4. RENDIR Y COBRAR", s["label_white"])],
        [
            P("• Ingresar ruta y flete ofrecido.<br/>• Estimar galones y peajes.<br/>• Verificar margen de ganancia.<br/>• Considerar retorno.", s["body_small"]),
            P("• Crear viaje comercial.<br/>• Asignar tracto y carreta.<br/>• Asignar conductor.<br/>• Entregar fondo/anticipo.", s["body_small"]),
            P("• Chofer abre app móvil.<br/>• Registra diésel y peajes.<br/>• Toma foto a comprobantes.<br/>• Reporta incidencias.", s["body_small"]),
            P("• Cuadre de gastos vs fondo.<br/>• Chofer devuelve vuelto.<br/>• Emisión de factura.<br/>• Cobro y reporte final.", s["body_small"]),
        ]
    ]
    flow_table = Table(flow_blocks, colWidths=[1.7 * inch] * 4)
    flow_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(flow_table)
    story.append(Spacer(1, 8))

    story.append(P("Diferenciación Clave: Los 3 Estados de un Viaje", s["h2"]))
    story.append(P(
        "Uno de los mayores errores en empresas de transporte es asumir que cuando el camión llega a destino, el viaje ya terminó. En el Centro de Control Digital, un servicio maneja 3 dimensiones separadas:",
        s["body"]
    ))

    states_desc = [
        "<b>Estado Operativo:</b> Indica dónde está físicamente el camión (<i>Borrador › Programado › En Ruta › Completado</i>).",
        "<b>Estado Administrativo / Rendición:</b> Indica si el chofer ya entregó todas sus cuentas y comprobantes (<i>Pendiente › En Revisión › Conciliado › Cerrado</i>).",
        "<b>Estado Financiero / Cobranza:</b> Indica si el cliente ya pagó el flete (<i>Por Facturar › Facturado › Cobro Parcial › Pagado</i>).",
    ]
    for sd in states_desc:
        story.append(bullet(sd, s))

    story.append(Spacer(1, 6))
    story.append(callout_box(
        s,
        "EJEMPLO DE CONTROL",
        "Un tracto puede haber completado la ruta Lima–Pisco (Operación: Completada), pero el chofer aún no ha devuelto S/. 120 sobrantes del anticipo (Rendición: Abierta) y el cliente pagará a 30 días (Cobranza: Pendiente). El sistema mantiene las alarmas encendidas hasta que los 3 estados se cierren al 100%.",
        bg_color=PALE_BLUE, title_style="label_blue"
    ))
    story.append(PageBreak())

    # =========================================================================
    # 4. PANTALLA A PANTALLA: ÍNDICE Y MAPA DE PANTALLAS
    # =========================================================================
    story.append(P("Índice Detallado de Pantallas del Sistema", s["title"]))
    story.append(P("Estructura completa de las 41 vistas del Centro de Control Digital documentadas en este manual.", s["subtitle"]))

    index_data = [
        [P("MÓDULO", s["label_white"]), P("PANTALLAS / VISTAS EXPLICADAS", s["label_white"]), P("PÁG. MANUAL", s["label_white"])],
        [P("<b>Acceso e Identidad</b>", s["label"]), P("Iniciar Sesión, Recuperar Clave, Mi Perfil y Diagnóstico Técnico.", s["body_small"]), P("Págs. 5 – 6", s["body_small"])],
        [P("<b>Operaciones Centrales</b>", s["label"]), P("Inicio (Dashboard), Directorio de Viajes, Nuevo Viaje, Expediente de Viaje (6 pestañas: Resumen, Operación, Dinero, Documentos, Incidencias, Historial), Programación, Ciclos Operativos y Evaluador de Viajes.", s["body_small"]), P("Págs. 7 – 18", s["body_small"])],
        [P("<b>Gestión de Maestros</b>", s["label"]), P("Flota y Detalle de Unidad, Conductores y Ficha, Clientes y Crédito.", s["body_small"]), P("Págs. 19 – 22", s["body_small"])],
        [P("<b>Dinero y Finanzas</b>", s["label"]), P("Gastos de Ruta, Combustible Diésel, Adelantos/Fondos, Rendiciones y Cierre con Vueltos, Cobranza y Cuentas por Cobrar.", s["body_small"]), P("Págs. 23 – 28", s["body_small"])],
        [P("<b>Control y Mantenimiento</b>", s["label"]), P("Planes de Mantenimiento, Nueva Orden de Trabajo, Cierre de OT con Repuestos, Centro de Documentos, Alertas del Sistema y Reportes Gerenciales.", s["body_small"]), P("Págs. 29 – 34", s["body_small"])],
        [P("<b>Gobierno y GPS</b>", s["label"]), P("Configuración de Empresa, Perfiles y Roles, Odómetro GPS Goldcar y Calibración.", s["body_small"]), P("Págs. 35 – 37", s["body_small"])],
        [P("<b>PWA Móvil del Conductor</b>", s["label"]), P("Mi Viaje, Registro de Combustible, Gastos de Ruta, Kilometraje y Foto Tablero, Incidencias en Ruta, Historial Local y Sincronización Offline.", s["body_small"]), P("Págs. 38 – 44", s["body_small"])],
        [P("<b>Casos Reales y Rutinas</b>", s["label"]), P("8 Casos Prácticos de la Vida Real y Checklist de Rutina Diaria del Dueño.", s["body_small"]), P("Págs. 45 – 46", s["body_small"])],
    ]
    index_table = Table(index_data, colWidths=[1.5 * inch, 4.3 * inch, 1.0 * inch])
    index_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(index_table)
    story.append(PageBreak())

    # =========================================================================
    # PANTALLAS INDIVIDUALES (1 a 37)
    # =========================================================================

    # 1. INICIAR SESIÓN Y CLAVE
    screen_section_page(
        story, s, "1", "Iniciar Sesión y Recuperación de Contraseña",
        "Puerta de entrada segura al sistema. Protege la información financiera y operativa de R&T SITRAM.",
        "Garantiza que nadie ajeno a la empresa acceda a tarifas, clientes o dinero. Cada empleado entra con su correo y contraseña individual.",
        ["Cuentas compartidas: Nunca permita que dos personas usen el mismo usuario.", "Intentos fallidos: Si alguien olvida la clave, use 'Establecer Clave'."],
        [
            "Ingrese su correo corporativo autorizado y contraseña.",
            "Si es su primera vez, abra el enlace de bienvenida recibido en su correo para definir su clave.",
            "Haga clic en 'Ingresar'. El sistema detectará su rol y abrirá su panel correspondiente.",
        ],
        [("Formulario de Ingreso", "Campos para Correo y Contraseña segura."), ("Establecer Clave", "Definición de clave con mínimo de seguridad."), ("Sin Acceso", "Aviso si la cuenta no pertenece a la empresa.")],
        "El administrador crea la cuenta 'chofer.juan@sitram.pe'. Juan ingresa al enlace desde su celular, escribe su contraseña secreta y accede directamente a la vista 'Mi Viaje'.",
        "Si un chofer dice que olvidó su clave, el administrador puede reenviarle un enlace de restablecimiento desde 'Perfiles de Usuario'. Nunca anote contraseñas en papeles.",
        caution_text="No comparta la contraseña de Gerencia con nadie. Su cuenta tiene poder para ver utilidades netas y autorizar cambios de odómetro."
    )

    # 2. MI PERFIL Y DIAGNÓSTICO
    screen_section_page(
        story, s, "2", "Mi Perfil y Diagnóstico del Sistema",
        "Información de la sesión actual y herramientas técnicas para verificar el estado de la conexión.",
        "Permite al usuario verificar sus datos personales y comprobar que la base de datos local y la nube estén comunicadas.",
        ["Estado 'Desconectado': Si Diagnóstico muestra error de red, verifique su WiFi o datos móviles."],
        [
            "Haga clic en el icono de usuario en la esquina superior derecha y elija 'Mi Perfil'.",
            "Revise su nombre, correo registrado y rol asignado.",
            "En caso de soporte técnico, abra '/diagnostico' para ver el estado de la base de datos SQLite y sincronización.",
        ],
        [("Datos del Usuario", "Nombre, Rol y Correo institucional."), ("Diagnóstico Técnico", "Latencia, estado de sincronización y caché.")],
        "El dueño entra a Diagnóstico antes de salir de viaje para confirmar que la base de datos en su laptop está 100% sincronizada con la nube.",
        "Si Diagnóstico muestra 'Error de Conexión', continúe trabajando: el sistema guardará todo en su equipo y sincronizará automáticamente apenas vuelva internet."
    )

    # 3. INICIO / DASHBOARD
    screen_section_page(
        story, s, "3", "Inicio: Centro de Control Diario (Dashboard)",
        "La pantalla más importante para el dueño. Resume en 10 segundos el estado completo de la empresa.",
        "Permite saber de un vistazo: cuántos camiones están trabajando, cuántos viajes están en ruta, cuánto dinero falta rendir y cuánto flete falta cobrar.",
        ["Flete por cobrar: Si el monto en rojo supera los S/. 50,000, priorice llamadas de cobranza.", "Rendiciones abiertas: Vigile choferes que llevan más de 48 horas sin liquidar gastos."],
        [
            "Revise los 4 bloques principales: Flota Disponible, Viajes Activos, Rendiciones Pendientes y Cobranza.",
            "Haga clic en cualquier tarjeta para saltar directamente a la lista de viajes o facturas pendientes.",
            "Atienda la franja de 'Atención Prioritaria': alertas de mantenimientos urgentes o documentos vencidos.",
        ],
        [("Pulso Operativo", "Contadores de camiones libres, en ruta y en taller."), ("Atención Prioritaria", "Alertas urgentes de documentos y dinero."), ("Dinero en Juego", "Total por cobrar y fondos por rendir.")],
        "El dueño abre el Dashboard a las 7:30 AM: Ve 4 tractos en ruta, 2 en base esperando carga, 1 en taller por frenos y S/. 18,400 listos para cobrar a Aceros Arequipa.",
        "Si una tarjeta muestra un número alarmante (ej. 3 camiones parados), haga clic en la tarjeta para ver exactamente qué placas son y por qué no están rodando."
    )

    # 4. DIRECTORIO DE VIAJES
    screen_section_page(
        story, s, "4", "Directorio de Viajes (Lista Maestra)",
        "El libro de control de todos los fletes de la empresa: pasados, presentes y programados.",
        "Permite ubicar cualquier flete en segundos por placa, cliente, conductor o fecha, evitando buscar en cuadernos viejos.",
        ["Viajes en 'Borrador': Fletes creados que aún no tienen camión asignado.", "Viajes con rendición pendiente: Viajes completados que no han cerrado cuentas."],
        [
            "Use los filtros superiores para ver: 'En Curso', 'Programados', 'Completados' o 'Por Rendir'.",
            "Escriba en el buscador el nombre del cliente (ej. 'Alicorp') o la placa (ej. 'V7B-840').",
            "Haga clic en el código del viaje (ej. 'VIAJE-2026-084') para abrir el expediente completo.",
        ],
        [("Filtros Rápidos", "Filtrar por estado operativo o financiero."), ("Tabla de Viajes", "Código, Cliente, Ruta, Unidad, Conductor, Flete y Estado."), ("Buscador", "Búsqueda instantánea por texto.")],
        "Un cliente llama preguntando por la carga enviada ayer a Pisco. El dueño digita 'Pisco' en el buscador, ve que el viaje está 'En Ruta' y que el chofer pasó Chincha hace 20 minutos.",
        "Si necesita exportar la lista de viajes del mes para el contador, filtre por rango de fechas y use la vista consolidada."
    )

    # 5. CREACIÓN DE NUEVO VIAJE
    screen_section_page(
        story, s, "5", "Crear Nuevo Viaje (Registro Comercial)",
        "Formulario de registro del compromiso de transporte pactado con el cliente.",
        "Garantiza que el precio pactado, el origen, destino y tipo de carga queden grabados sin confusiones antes de que el camión arranque.",
        ["Flete sin IGV vs con IGV: Especifique claramente la moneda y condición de impuestos.", "Carga peligrosa o especial: Verifique si requiere permisos adicionales."],
        [
            "Haga clic en el botón '+ Nuevo Viaje' desde el Directorio de Viajes.",
            "Seleccione el Cliente de la lista desplegable.",
            "Indique el Origen (ej. 'Planta Lurín') y Destino (ej. 'Mina Shougang Marcona').",
            "Escriba la descripción de la carga (ej. '30 TN Varillas de Acero') y el Flete acordado (ej. 'S/. 3,500 + IGV').",
            "Guarde el registro. El viaje quedará en estado 'Borrador' listo para ser programado.",
        ],
        [("Datos Comerciales", "Cliente, Flete acordado, Moneda y Condición de Pago."), ("Ruta y Carga", "Origen, Destino, Tipo de mercadería y Peso estimado."), ("Acción", "Guardar Borrador o Pasar a Programación.")],
        "Llaman de Corporación Aceros para mover 28 toneladas a Pisco por S/. 2,400. La administradora llena el formulario en 1 minuto y el viaje queda registrado con código único.",
        "Si el cliente cambia de ruta a última hora, modifique el destino en el viaje antes de que el conductor inicie la salida en su app móvil."
    )

    # 6. EXPEDIENTE: PESTAÑA RESUMEN
    screen_section_page(
        story, s, "6", "Expediente del Viaje — Pestaña 1: Resumen",
        "Ficha principal del viaje. Muestra la hoja de ruta completa y los responsables asignados.",
        "Permite entender todo el viaje en una sola mirada: quién maneja, qué camión va, cuánto se cobra y qué falta completar.",
        ["Verifique que la unidad asignada no tenga órdenes de mantenimiento pendientes.", "Confirme que el flete registrado coincida con la orden de compra del cliente."],
        [
            "Abra el viaje desde el directorio y seleccione la pestaña 'Resumen'.",
            "Revise la tarjeta 'Ruta y Fechas' (salida programada vs salida real).",
            "Revise la tarjeta 'Recursos Asignados' (Tracto, Carreta y Conductor titular).",
            "Compruebe el estado global en la barra de progreso superior.",
        ],
        [("Encabezado de Estado", "Barra visual con la etapa actual del servicio."), ("Tarjeta Comercial", "Cliente, Flete, Orden de Compra y Contacto."), ("Tarjeta Operativa", "Tracto, Semirremolque, Chofer y Odómetros.")],
        "El dueño revisa el Viaje #092: ve que el cliente es Minera Chala, el flete es S/. 4,200, el chofer es Carlos Mendoza y el tracto es el Volvo V7B-840.",
        "Si el chofer asignado se enferma antes de partir, cambie la asignación en la pestaña Resumen o en Programación antes del despacho."
    )

    # 7. EXPEDIENTE: PESTAÑA OPERACIÓN
    screen_section_page(
        story, s, "7", "Expediente del Viaje — Pestaña 2: Operación",
        "Control en tiempo real de las etapas del viaje: Despacho, Salida, Tránsito, Llegada y Descarga.",
        "Permite saber con precisión de minutos cuándo salió el camión de planta, cuánto demoró en ruta y a qué hora descargó.",
        ["Demoras en planta de carga o descarga: Anote la hora exacta para poder cobrar sobrestadía/falso flete al cliente si aplica."],
        [
            "Consulte la línea de tiempo de etapas del viaje.",
            "Administración puede registrar los hitos si el chofer no tiene teléfono con batería.",
            "Verifique el odómetro inicial al salir de la base y el odómetro final al llegar a destino.",
        ],
        [("Línea de Etapas", "Hitos: Programado › Despachado › En Ruta › En Destino › Descargado."), ("Registro de Odómetro", "Kilometraje de inicio y fin de ruta."), ("Tiempos de Espera", "Cálculo automático de horas en tránsito.")],
        "El cliente reclama que el camión llegó tarde. El dueño abre la pestaña Operación y demuestra con fecha/hora que el tracto estuvo esperando 4 horas en la puerta del cliente para que le dieran pase de descarga.",
        "Si el chofer olvida marcar 'Llegada' en su app móvil, Administración puede actualizar el hito con la hora real desde esta pantalla."
    )

    # 8. EXPEDIENTE: PESTAÑA DINERO
    screen_section_page(
        story, s, "8", "Expediente del Viaje — Pestaña 3: Dinero y Costos",
        "El corazón financiero del viaje. Consolida el flete, combustible, peajes, viáticos y utilidad neta.",
        "Permite ver exactamente cuánto dinero dejó de ganancia limpia este viaje específico.",
        ["Margen de Ganancia: Si el margen baja del 25%, investigue si hubo exceso de consumo de diésel o peajes no planificados."],
        [
            "Abra la pestaña 'Dinero' en el expediente del viaje.",
            "Observe el cuadro comparativo: Ingreso por Flete vs Costos Totales de Ruta.",
            "Desglose los costos: Combustible Diésel, Peajes, Viáticos de chofer, Gastos varios y Mantenimiento prorrateado.",
            "Revise la 'Utilidad Estimada' y el 'Margen Real' en porcentaje.",
        ],
        [("Balance del Viaje", "Flete total menos costos directos = Utilidad Neta."), ("Desglose de Costos", "Combustible, Peajes, Viáticos y Otros gastos."), ("Fondo y Rendición", "Anticipo entregado vs Gastos justificados.")],
        "Viaje a Ica: Flete S/. 2,800. Diésel S/. 950, Peajes S/. 180, Viáticos S/. 200. Costo total: S/. 1,330. Utilidad limpia para R&T: S/. 1,470 (Margen: 52.5%).",
        "Si aparece un gasto sospechoso (ej. 'Reparación de llanta S/. 150'), haga clic sobre el gasto para ver la foto de la boleta y el motivo registrado."
    )

    # 9. EXPEDIENTE: PESTAÑA DOCUMENTOS
    screen_section_page(
        story, s, "9", "Expediente del Viaje — Pestaña 4: Documentos y Fotos",
        "Bóveda digital de evidencias del viaje: Guía de Remisión Remitente, Guía Transportista, Tickets y Fotos de Carga.",
        "Evita que se pierdan las guías físicas firmadas y selladas por el cliente, que son el único sustento legal para cobrar la factura.",
        ["Guía sin sello de recepción: Nunca facture un viaje si la foto de la guía no tiene la firma y sello legible de quien recibió la carga en destino."],
        [
            "Consulte las fotos subidas por el conductor desde su celular o cargue archivos desde su computadora.",
            "Haga clic en cualquier documento para abrirlo en alta resolución.",
            "Verifique que la Guía de Remisión tenga: Sello de 'Conforme', Fecha y Firma del receptor.",
        ],
        [("Galería de Archivos", "Miniaturas de Guías, Vales de Grifo y Boletas de Peaje."), ("Visor Privado", "Ampliación de imagen con zoom para leer firmas."), ("Subir Documento", "Botón para adjuntar PDFs o fotos escaneadas.")],
        "El chofer descarga cemento en Pisco, toma una foto nítida de la Guía firmada con su celular y la sube. Al instante, la oficina en Lima puede ver la guía y emitir la factura sin esperar que el chofer vuelva en 3 días.",
        "Si una foto se ve borrosa, rechace el documento y solicite al chofer que tome una nueva foto antes de abandonar el lugar de entrega."
    )

    # 10. EXPEDIENTE: PESTAÑA INCIDENCIAS
    screen_section_page(
        story, s, "10", "Expediente del Viaje — Pestaña 5: Incidencias en Ruta",
        "Bitácora de eventos extraordinarios: pinchazos de llantas, bloqueos de carretera, fallas mecánicas o demoras policiales.",
        "Protege a la empresa ante quejas de clientes por retrasos y documenta sobrecostos generados por imprevistos.",
        ["Frecuencia de fallas: Si una unidad reporta pinchazos seguidos, revise el estado de los neumáticos en Mantenimiento."],
        [
            "Revise las incidencias reportadas por el conductor o registradas por la oficina.",
            "Lea la descripción, fecha/hora exacta y fotos adjuntas.",
            "Indique la acción de resolución (ej. 'Se envió auxilio mecánico' o 'Se coordinó desvío').",
        ],
        [("Lista de Incidencias", "Tipo (Mecánica, Tráfico, Clima, Carga), Severidad y Estado."), ("Detalle y Evidencia", "Fotos del problema y ubicación aproximada."), ("Resolución", "Notas sobre cómo se solucionó el problema.")],
        "En la Panamericana Sur hay un bloqueo de transportistas por 6 horas. El chofer registra la incidencia con foto. El dueño llama al cliente con la evidencia en mano para justificar la demora sin penalidades.",
        "Si la incidencia generó un gasto extra (ej. S/. 80 por parchar una llanta), el sistema permite enlazar ese gasto a la incidencia para justificarlo en la rendición."
    )

    # 11. EXPEDIENTE: PESTAÑA HISTORIAL
    screen_section_page(
        story, s, "11", "Expediente del Viaje — Pestaña 6: Historial y Auditoría",
        "Caja negra inmutable del viaje. Registra quién hizo qué, cuándo y desde qué dispositivo.",
        "Evita discusiones internas: nadie puede alterar un precio, borrar un gasto o cambiar una fecha sin que quede registrado su nombre y hora exacta.",
        ["Modificaciones sospechosas: Revise si alguien editó el monto de un gasto posterior a su aprobación."],
        [
            "Abra la pestaña 'Historial' para ver la lista cronológica de eventos.",
            "Consulte cada registro: Fecha, Hora, Usuario, Acción realizada y Valor anterior vs Valor nuevo.",
        ],
        [("Línea de Tiempo", "Eventos ordenados del más reciente al más antiguo."), ("Detalle de Cambio", "Comparativo antes y después de cada edición.")],
        "Aparece una discrepancia en el flete acordado (S/. 3,000 vs S/. 3,200). El dueño abre Historial y comprueba que la administradora corrigió el monto el martes a las 4:15 PM por indicación del cliente.",
        "Los registros de auditoría no se pueden borrar ni por el administrador ni por el dueño. Es la garantía de transparencia del negocio."
    )

    # 12. PROGRAMACIÓN DE SALIDAS
    screen_section_page(
        story, s, "12", "Programación de Salidas y Asignación de Recursos",
        "El tablero de despacho donde se cruzan las cargas aprobadas con los camiones y choferes disponibles.",
        "Evita asignar un camión que tiene el SOAT vencido o un chofer que no ha descansado las horas reglamentarias.",
        ["Alertas de Bloqueo: El sistema impedirá programar si la unidad tiene una orden de taller abierta o papeles vencidos."],
        [
            "Revise en la columna izquierda los viajes pendientes de programación.",
            "Seleccione el Tracto y la Carreta (Semirremolque) que tengan capacidad para la carga.",
            "Seleccione al Conductor disponible.",
            "Haga clic en 'Confirmar Programación'. El viaje aparecerá inmediatamente en el celular del conductor asignado.",
        ],
        [("Viajes por Programar", "Lista de cargas comerciales listas para salir."), ("Selector de Flota", "Filtro de tractos y carretas libres y aptas."), ("Selector de Chofer", "Filtro de conductores disponibles."), ("Botón Despacho", "Generar orden de salida oficial.")],
        "Viaje a Marcona con 32 toneladas: La administradora selecciona el Tracto Volvo V7B-840 (capacidad 35 TN) y al conductor Juan Pérez. El sistema valida que el SOAT vence en 6 meses y confirma el despacho.",
        "Si un camión aparece en color gris 'No Disponible', pase el cursor por encima para ver si está en taller o ya asignado a otro viaje en curso."
    )

    # 13. CICLOS OPERATIVOS
    screen_section_page(
        story, s, "13", "Ciclos Operativos (Ida, Retorno y Continuidad)",
        "Agrupación inteligente de viajes para evaluar la rentabilidad completa de una vuelta de camión.",
        "Permite saber si un viaje de ida muy rentable terminó perdiendo plata por regresar vacío o con un flete de retorno muy barato.",
        ["Retorno en falso (vacío): Busque siempre fletes de retorno aunque sea a tarifa menor para cubrir el diésel de vuelta."],
        [
            "Cree un 'Ciclo Operativo' y asígnele un nombre (ej. 'Vuelta Sur: Lima - Arequipa - Lima').",
            "Vincule el Viaje de Ida (ej. Lima › Arequipa con cemento).",
            "Vincule el Viaje de Retorno (ej. Arequipa › Lima con cebollas) o marque 'Retorno Vacío'.",
            "Revise el balance económico consolidado de toda la vuelta del camión.",
        ],
        [("Encabezado de Ciclo", "Unidad, Fechas de salida y regreso total."), ("Tramos Asociados", "Viaje de Ida, Viaje de Retorno o Continuaciones."), ("Balance del Ciclo", "Fletes totales vs Gastos totales de la vuelta.")],
        "Tracto va a Pisco por S/. 2,200 (gasto S/. 900). En Pisco consigue carga de retorno a Lurín por S/. 1,400 (gasto S/. 400). El Ciclo completo generó S/. 3,600 de ingreso y S/. 1,300 de gasto = Utilidad neta S/. 2,300.",
        "Mantenga cada viaje facturado por separado al cliente respectivo; el ciclo solo sirve para análisis gerencial interno de rentabilidad de la unidad."
    )

    # 14. EVALUADOR DE VIAJES (COTIZADOR)
    screen_section_page(
        story, s, "14", "Evaluador de Viajes y Cotizador de Rentabilidad",
        "Calculadora económica inteligente para cotizar fletes en 30 segundos antes de aceptar una carga.",
        "Le dice al dueño si un flete propuesto por un cliente es buen negocio o si va a perder plata antes de mover el camión.",
        ["Margen Mínimo: No acepte viajes cuyo margen proyectado sea menor al 20% salvo que sea un retorno estratégico."],
        [
            "Ingrese el Origen y Destino de la ruta propuesta.",
            "El sistema calculará la distancia aproximada en kilómetros y el costo estimado de peajes.",
            "Ingrese el Flete que ofrece pagar el cliente.",
            "Indique el precio del galón de diésel y el consumo estimado de la unidad (ej. 8.5 km/galón).",
            "Observe el resultado instantáneo: Utilidad proyectada en Soles y Margen de Rentabilidad.",
        ],
        [("Parámetros de Ruta", "Kilómetros, Peajes de ida y vuelta."), ("Fórmula de Diésel", "Cálculo de galones requeridos según peso de carga."), ("Resultado Comercial", "Sugerencia: 'Aceptar', 'Renegociar' o 'Rechazar'.")],
        "Un cliente ofrece S/. 1,800 por llevar tubos a Chincha. El Evaluador calcula S/. 820 de diésel + S/. 140 de peajes + S/. 200 de chofer = Costo S/. 1,160. Margen: 35.5% (S/. 640 de ganancia). El dueño acepta el servicio.",
        "La política económica de costos por kilómetro es editable en la configuración de la empresa para adaptarse a subidas del precio del combustible."
    )

    # 15. FLOTA DE VEHÍCULOS
    screen_section_page(
        story, s, "15", "Flota de Vehículos (Tractos y Carretas)",
        "Inventario maestro de activos rodantes de la empresa: tracto-camiones, semirremolques plataformas, furgones y cisternas.",
        "Muestra el estado de salud de cada camión: kilometraje actual, ubicación estimada, estado mecánico y disponibilidad.",
        ["Camiones parados: Cada día que un camión no rueda representa pérdida de costo fijo. Revise por qué no tiene asignación."],
        [
            "Consulte la lista de unidades con su placa, marca, modelo, año y odómetro actual.",
            "Filtre por tipo: 'Tracto' o 'Semirremolque/Carreta'.",
            "Revise la columna de estado: 'Disponible' (Verde), 'En Ruta' (Azul), 'En Taller' (Rojo).",
            "Haga clic en una placa para ver su historial técnico y documentos.",
        ],
        [("Tarjetas de Flota", "Resumen de unidades operativas vs en mantenimiento."), ("Tabla de Unidades", "Placa, Tipo, Capacidad TN, Odómetro y Estado actual."), ("Botón + Nueva Unidad", "Registrar un camión o carreta recién adquirida.")],
        "El dueño revisa la lista: Tracto V7B-840 (Volvo FH) tiene 485,200 km y está en ruta; Carreta B4T-982 (Plataforma 3 ejes) está en base disponible para acoplar.",
        "Si vende una unidad o termina un contrato de alquiler, márquela como 'Inactiva' para que no aparezca en la programación de viajes."
    )

    # 16. DETALLE DE UNIDAD
    screen_section_page(
        story, s, "16", "Detalle de Unidad (Ficha Técnica y Vida del Camión)",
        "Expediente técnico completo de un vehículo específico: mantenimientos realizados, piezas cambiadas y documentos vigentes.",
        "Permite evaluar cuánto dinero ha consumido un camión en reparaciones a lo largo del año vs cuánto dinero ha facturado.",
        ["Costo de Mantenimiento Acumulado: Si una unidad gasta más de lo que produce en fletes, evalúe su renovación."],
        [
            "Abra la ficha de la unidad desde la lista de Flota.",
            "Consulte la pestaña 'Documentos' para ver vigencia de SOAT, Revisión Técnica y Póliza.",
            "Consulte la pestaña 'Historial de Mantenimientos' para ver todas las órdenes de trabajo cerradas.",
            "Revise el odómetro oficial respaldado por las lecturas de los viajes y el GPS.",
        ],
        [("Ficha del Vehículo", "Placa, VIN, Motor, Configuración de ejes y Carga útil."), ("Semáforo Documental", "Fechas de caducidad con alertas por colores."), ("Historial Mecánico", "Cronograma de cambios de aceite, llantas y frenos.")],
        "Tracto V7B-840: El dueño ve que en los últimos 6 meses ha generado S/. 68,000 en fletes y ha tenido S/. 4,200 en mantenimiento preventivo (muy rentable).",
        "Suba siempre una copia en PDF del SOAT y CITV a la ficha de la unidad para que cualquier chofer pueda mostrarlo en su celular ante una fiscalización de SUTRAN."
    )

    # 17. CONDUCTORES
    screen_section_page(
        story, s, "17", "Conductores (Ficha del Personal de Ruta)",
        "Directorio de choferes profesionales de R&T SITRAM con control de licencias, récords y viajes asignados.",
        "Evita asignar a un chofer con brevete vencido o que tenga retenciones pendientes de rendiciones anteriores.",
        ["Brevete / Licencia A-IIIc o Especial: Vigile las fechas de revalidación para evitar multas graves de SUTRAN/PNP."],
        [
            "Consulte la lista de conductores: Nombre completo, DNI, Licencia, Teléfono y Estado.",
            "Revise si el conductor tiene viaje asignado actualmente.",
            "Abra el detalle de un conductor para consultar su historial de viajes realizados y rendiciones.",
        ],
        [("Tabla de Conductores", "Datos personales, Categoría de Licencia y Vigencia."), ("Estado de Conductor", "'Disponible', 'En Viaje', 'De Descanso', 'Inactivo'."), ("Botón + Nuevo Conductor", "Registrar a un nuevo chofer.")],
        "Se va a contratar al chofer Pedro Huamán: Se registra su DNI, licencia A-IIIc con vencimiento 2028, número de teléfono y se le genera su acceso a la PWA móvil.",
        "Si un conductor renuncia o es despedido, desactive su usuario de inmediato para revocar su acceso al sistema de la empresa."
    )

    # 18. CLIENTES
    screen_section_page(
        story, s, "18", "Clientes (Cartera Comercial y Condiciones de Pago)",
        "Registro maestro de empresas generadoras de carga que contratan los servicios de transporte de R&T.",
        "Permite llevar el control del crédito comercial: cuántos días de plazo tiene cada cliente (ej. Contado, 15, 30 o 60 días) y su límite de deuda.",
        ["Clientes morosos: No autorice nuevos viajes a clientes que tengan facturas vencidas con más de 15 días de retraso."],
        [
            "Consulte el directorio de clientes: Razón Social, RUC, Dirección fiscal y Contacto comercial.",
            "Revise la columna 'Condición de Pago' (ej. 'Factura a 30 días').",
            "Abra el detalle del cliente para ver el historial de fletes realizados y facturas pendientes de cobro.",
        ],
        [("Cartera de Clientes", "Directorio con RUC, Razón Social y Teléfonos."), ("Límite de Crédito", "Días de plazo pactados y saldo deudor actual."), ("Historial Comercial", "Total de fletes facturados en el año.")],
        "Cliente 'Aceros Corp': RUC 20548963214, plazo de pago 30 días. El sistema muestra que tiene 2 facturas pendientes por S/. 5,600 que vencen la próxima semana.",
        "Registre siempre el correo del área de Cuentas por Pagar del cliente para que las facturas y guías escaneadas se envíen automáticamente."
    )

    # 19. FINANZAS: GASTOS DE RUTA
    screen_section_page(
        story, s, "19", "Registro y Control de Gastos de Ruta",
        "Bandeja de auditoría de todos los desembolsos menores de viaje: peajes, viáticos, cocheras, estiba y pesajes.",
        "Permite revisar uno a uno los gastos reportados por los choferes o registrados por la oficina antes de autorizarlos en la liquidación.",
        ["Gastos sin sustento: Exija comprobante (boleta, factura o ticket de peaje) para todo gasto mayor a S/. 20."],
        [
            "Consulte la lista de gastos filtrando por viaje, fecha o conductor.",
            "Haga clic sobre un gasto para ver el comprobante adjunto (foto de boleta).",
            "Opciones de revisión: 'Aprobar', 'Observar' (pedir aclaración) o 'Rechazar' (gasto no asumido por la empresa).",
            "Administración puede ingresar gastos pagados directamente por la oficina.",
        ],
        [("Bandeja de Gastos", "Monto, Categoría (Peaje, Cochera, Comida, Reparación), Fecha y Chofer."), ("Revisor de Evidencias", "Foto del ticket tomada con el celular."), ("Acciones de Auditoría", "Botones para Aprobar o Rechazar el gasto.")],
        "El chofer registra 'Cochera en Pisco S/. 25' y sube la foto del ticket manual sellado. Administración revisa la foto, verifica la fecha y hace clic en 'Aprobar'.",
        "Si el chofer registra un gasto excesivo (ej. 'Almuerzo S/. 90'), la administradora puede 'Observar' el gasto para que Gerencia decida si se reconoce completo o solo el tope de política (ej. S/. 30)."
    )

    # 20. FINANZAS: COMBUSTIBLE
    screen_section_page(
        story, s, "20", "Abastecimiento de Combustible Diésel",
        "Control milimétrico del gasto más pesado del transporte: galones, precio por galón, grifo, odómetro y rendimiento.",
        "Detecta inmediatamente si un camión está consumiendo más diésel de lo normal o si hay sospecha de ordeñe/desvío de combustible.",
        ["Rendimiento km/galón: Un tracto cargado debe rendir entre 7.5 y 9.0 km/galón. Si rinde menos de 6.5 km/galón, hay un problema mecánico o fuga."],
        [
            "Revise los abastecimientos registrados: Galones, Monto en Soles, Grifo proveedor y Odómetro de la unidad.",
            "Verifique si fue pagado con: 'Efectivo del Chofer', 'Tarjeta de Grifo' o 'Crédito con Factura a Fin de Mes'.",
            "Compruebe la foto del odómetro y del voucher del surtidor.",
            "Analice el cálculo automático de 'Rendimiento de Combustible'.",
        ],
        [("Registro de Abastecimientos", "Fecha, Placa, Grifo, Galones, Precio/Galón y Total S/."), ("Tipo de Pago", "Diferenciación entre Efectivo del chofer vs Crédito institucional."), ("Cálculo de Eficiencia", "Kilómetros recorridos entre galones consumidos.")],
        "Tracto V7B-840 abastece en Primax Chincha: 65 galones a S/. 16.80 = S/. 1,092. Recorrió 540 km. Rendimiento: 8.3 km/galón (Excelente). Pagado con vale de crédito R&T.",
        "Diferencie bien los abastecimientos pagados al crédito de los pagados en efectivo por el chofer: solo los de efectivo entran en la rendición del chofer; los de crédito van a la cuenta por pagar del grifo."
    )

    # 21. FINANZAS: ADELANTOS / FONDOS
    screen_section_page(
        story, s, "21", "Adelantos y Fondos Operativos para Viaje",
        "Control de las transferencias de dinero entregadas al conductor para cubrir los gastos de la ruta.",
        "Garantiza que todo dinero que sale de la cuenta bancaria de R&T quede registrado como un 'Fondo a Rendir' y no como un regalo o sueldo.",
        ["Fondos acumulados: No entregue un nuevo anticipo a un chofer si tiene pendiente de rendir el fondo del viaje anterior."],
        [
            "Haga clic en '+ Nuevo Adelanto' dentro del viaje o desde el módulo de Finanzas.",
            "Seleccione el Conductor y el Viaje correspondiente.",
            "Ingrese el Monto entregado (ej. S/. 500) y el Medio de Pago (Transferencia BCP, Yape, Plin o Efectivo).",
            "Adjunte el número de operación bancaria o captura de transferencia.",
            "Guarde el registro. El monto se sumará a la cuenta por rendir del chofer para ese viaje.",
        ],
        [("Registro de Anticipos", "Monto, Conductor, Viaje, Fecha y Medio de pago."), ("Sustento Bancario", "Número de operación de transferencia."), ("Saldo por Rendir", "Monto total entregado pendiente de justificar.")],
        "Se despacha viaje a Ica: La administradora transfiere S/. 400 por banca móvil al BCP del chofer Juan Pérez. Registra el adelanto en el sistema con el número de operación 'OP-48921'.",
        "Si durante el viaje el camión sufre un percance y el chofer necesita S/. 200 adicionales, regístrelo como un segundo adelanto asociado al mismo viaje."
    )

    # 22. FINANZAS: RENDICIONES
    screen_section_page(
        story, s, "22", "Rendición de Cuentas (Liquidación de Viaje)",
        "Bandeja de conciliación donde se cruza el dinero entregado contra los gastos reales aprobados.",
        "Permite saber exactamente si el chofer debe devolver dinero a la empresa o si la empresa debe reembolsarle plata de su bolsillo.",
        ["Rendiciones abiertas por más de 72 horas: Cierre las rendiciones inmediatamente al retorno del camión para evitar olvidos."],
        [
            "Consulte la tabla de rendiciones por estado: 'Pendientes', 'En Revisión' y 'Cerradas'.",
            "Abra la rendición del viaje completado.",
            "Revise el balance automático: Total Anticipos entregados menos Total Gastos aprobados.",
            "Observe el 'Saldo Resultante':",
            "  › Si es positivo: 'Saldo a favor de la Empresa' (El chofer debe devolver vuelto).",
            "  › Si es negativo: 'Saldo a favor del Conductor' (La empresa debe reembolsarle).",
        ],
        [("Tabla de Rendiciones", "Viaje, Conductor, Total Fondo, Total Gastos, Saldo y Estado."), ("Filtro de Estado", "Ver rápidamente qué liquidaciones faltan cerrar."), ("Acceso a Detalle", "Abrir expediente para cuadre final.")],
        "Chofer recibió S/. 500 de adelanto. En ruta gastó S/. 380 (peajes S/. 180 + comida S/. 120 + cochera S/. 80). El sistema calcula: Saldo a favor de R&T = S/. 120 (El chofer debe devolver S/. 120).",
        "No considere cerrado un viaje hasta que la rendición esté conciliada y el vuelto físicamente depositado o entregado."
    )

    # 23. DETALLE Y CIERRE DE RENDICIÓN
    screen_section_page(
        story, s, "23", "Detalle y Cierre de Rendición (Cuadre de Vueltos)",
        "Pantalla donde se formaliza la devolución de dinero o el reembolso y se sella la rendición.",
        "Bloquea cualquier intento de alterar gastos una vez que el chofer y la empresa han firmado el cuadre de cuentas.",
        ["Medio y Referencia obligatorios: Nunca cierre una rendición con saldo pendiente sin registrar el número de operación del vuelto."],
        [
            "Verifique la lista final de gastos y comprobantes aceptados.",
            "Si el chofer devuelve vuelto (ej. S/. 120):",
            "  › Seleccione el medio: 'Yape / Transferencia' o 'Efectivo en Caja'.",
            "  › Ingrese el número de operación o comprobante de depósito.",
            "Si la empresa reembolsa al chofer (ej. gastó S/. 50 de más):",
            "  › Registre la transferencia de reembolso realizada al chofer.",
            "Haga clic en 'Cerrar y Sellar Rendición'. El estado pasará a 'Cerrada' (Inmutable).",
        ],
        [("Resumen de Cuadre", "Comparativo Fondo vs Gastos Aprobados = Saldo Final."), ("Formulario de Regularización", "Medio de pago, Fecha, N° Operación y Nota."), ("Botón de Cierre Definitivo", "Sellar liquidación con auditoría.")],
        "El chofer Juan devuelve los S/. 120 sobrantes mediante Yape a la cuenta de la empresa. La administradora ingresa 'Yape Op: 894512' y hace clic en 'Cerrar Rendición'. El viaje queda financieramente limpio.",
        "Si después del cierre aparece una boleta extraviada de S/. 30, se requiere una 'Reapertura Excepcional de Rendición' autorizada únicamente por Gerencia con motivo justificado."
    )

    # 24. FINANZAS: COBRANZA
    screen_section_page(
        story, s, "24", "Cobranza y Cuentas por Cobrar a Clientes",
        "Control de facturas emitidas, fechas de vencimiento, detracciones del Banco de la Nación y pagos recibidos.",
        "Asegura que no se escape ninguna factura sin cobrar y alerta sobre clientes que se están atrasando en sus pagos.",
        ["Detracción del 4% (SPOT): Verifique que el cliente haya depositado la constancia de detracción en la cuenta del Banco de la Nación antes de dar por cancelada la factura."],
        [
            "Consulte el listado de facturas emitidas y fletes pendientes de facturación.",
            "Revise los semáforos de vencimiento: Verde (Al día), Amarillo (Por vencer en 5 días), Rojo (Vencida).",
            "Para registrar un cobro, haga clic en '+ Registrar Abono / Pago'.",
            "Ingrese el monto abonado por el cliente, banco de ingreso y número de operación.",
            "Si el cliente hizo pago parcial, el sistema actualizará el 'Saldo Pendiente'.",
        ],
        [("Bandeja de Cobranzas", "Cliente, Factura, Fecha emisión, Vencimiento, Monto Total y Saldo."), ("Semáforo de Morosidad", "Alertas visuales de facturas vencidas."), ("Registro de Pagos", "Abonos parciales o cancelación total.")],
        "Factura a Aceros Arequipa por S/. 3,540 (con IGV). El cliente abona el 96% neto (S/. 3,398.40) al BCP y deposita el 4% de detracción (S/. 141.60) al Banco de la Nación. Se registran ambos comprobantes y la factura queda 'Pagada 100%'.",
        "Use el filtro 'Por Vencer esta Semana' los lunes por la mañana para que administración envíe recordatorios de pago a los clientes antes de que caigan en mora."
    )

    # 25. MANTENIMIENTO: PLANES Y HISTORIAL
    screen_section_page(
        story, s, "25", "Gestión de Mantenimiento de Flota",
        "Módulo de salud mecánica de camiones y carretas: mantenimiento preventivo programado y correctivo.",
        "Evita averías costosas en carretera programando a tiempo cambios de aceite, engrase de ejes, revisión de frenos y rotación de llantas.",
        ["Mantenimiento vencido: Un camión con cambio de aceite pasado por más de 2,000 km desgasta el motor prematuramente."],
        [
            "Consulte el calendario de mantenimientos preventivos por kilometraje o fecha.",
            "Revise el estado de cada plan: 'Al día', 'Próximo a vencer' o 'Vencido'.",
            "Consulte el historial de órdenes de trabajo ejecutadas en talleres propios o externos.",
            "Haga clic en '+ Nueva Orden de Trabajo' cuando una unidad requiera ingresar a taller.",
        ],
        [("Semáforo Mecánico", "Estado de cada tracto respecto a su próximo servicio."), ("Planes Preventivos", "Reglas: Cambio de aceite cada 15,000 km, Engrase cada 5,000 km."), ("Historial de Reparaciones", "Lista de todas las órdenes de trabajo pasadas.")],
        "Tracto V7B-840 llega a los 495,000 km: El sistema activa una alerta amarilla indicando que le tocan 'Filtros y Aceite de Motor' en 500 km. La administradora agenda el taller antes de asignarle un viaje largo.",
        "Configure planes preventivos basados tanto en kilómetros (para camiones que ruedan diario) como en días calendario (para carretas o cisternas)."
    )

    # 26. NUEVA ORDEN DE TRABAJO
    screen_section_page(
        story, s, "26", "Crear Nueva Orden de Trabajo (Ingreso a Taller)",
        "Formulario oficial de internamiento de un camión o carreta para reparación o servicio técnico.",
        "Garantiza que la unidad quede marcada como 'En Taller' (No disponible para viajes) y que se documente la falla exacta reportada.",
        ["Condición de Bloqueo: Si la falla es crítica (ej. frenos o dirección), marque 'Bloquear Unidad' para que nadie pueda programarla."],
        [
            "Haga clic en '+ Nueva Orden de Trabajo'.",
            "Seleccione la Unidad (Tracto o Semirremolque) e ingrese el Odómetro actual.",
            "Seleccione el Tipo: 'Preventivo Programado' o 'Correctivo por Falla'.",
            "Indique el Taller: 'Taller Interno R&T' o 'Taller Externo' (ej. Taller San Cristóbal).",
            "Describa el problema reportado por el conductor o la rutina a realizar.",
            "Guarde la orden. La unidad cambiará a estado 'En Mantenimiento'.",
        ],
        [("Datos de Ingreso", "Placa, Odómetro de ingreso, Fecha y Taller responsable."), ("Diagnóstico Preliminar", "Descripción de la falla o servicio solicitado."), ("Control de Disponibilidad", "Interruptor para bloquear la unidad en programación.")],
        "El chofer reporta que siente vibración en el eje delantero. Se abre la Orden OT-2026-042 para el Tracto V7B-840 en Taller Externo 'Frenos y Dirección Lurín' con bloqueo de unidad.",
        "Si el mantenimiento es menor y no impide que el camión ruede en viajes locales (ej. cambio de foco de placa), puede dejar la unidad desbloqueada con advertencia."
    )

    # 27. DETALLE Y CIERRE DE ORDEN DE TRABAJO
    screen_section_page(
        story, s, "27", "Detalle y Cierre de Orden de Trabajo (Repuestos y Costos)",
        "Liquidación técnica y económica de la reparación: repuestos comprados, mano de obra, factura y liberación del camión.",
        "Evita cobros inflados de talleres mecánicos y lleva el inventario exacto de qué repuestos se instalaron en qué placa.",
        ["Conciliación de Repuestos: Verifique que la suma de repuestos individuales coincida con la factura del proveedor."],
        [
            "Abra la Orden de Trabajo en proceso.",
            "Registre los repuestos utilizados: Nombre de pieza, Cantidad, Proveedor y Costo unitario.",
            "Registre el costo de Mano de Obra del taller.",
            "Adjunte fotos de las piezas cambiadas y la factura del taller.",
            "Ingrese el odómetro de salida y las conclusiones del mecánico.",
            "Haga clic en 'Cerrar Orden de Trabajo'. La unidad volverá a estar 'Disponible' para viajes.",
        ],
        [("Detalle de Reparación", "Trabajo realizado y diagnóstico final."), ("Tabla de Repuestos", "Lista de repuestos con costo y factura asociada."), ("Evidencias Fotográficas", "Fotos de repuestos viejos y nuevos instalados."), ("Botón de Alta Técnica", "Liberar camión para operación.")],
        "OT-2026-042: Se cambiaron 2 tambores de freno (S/. 680 c/u) + juego de pastillas (S/. 320) + Mano de obra (S/. 250). Costo total OT: S/. 1,930. Se adjuntan fotos y factura de repuestos. Se da de alta la unidad.",
        "Exija siempre a los choferes o al taller tomar foto de los repuestos usados que se retiran del camión antes de botarlos para constatar el cambio real."
    )

    # 28. CENTRO DE DOCUMENTOS
    screen_section_page(
        story, s, "28", "Centro de Documentos y Control de Vencimientos",
        "Archivo central de documentación legal de la empresa, camiones, carretas y conductores.",
        "Protege a la empresa de multas millonarias, retención de camiones o clausura de operaciones por papeles vencidos.",
        ["Vencimientos a 30 días: Tramite renovaciones de SOAT y Revisiones Técnicas con al menos 15 días de anticipación."],
        [
            "Consulte la matriz de documentos filtrando por: Empresa, Vehículo o Conductor.",
            "Revise los semáforos de vigencia: Verde (> 30 días), Amarillo (Vence en < 15 días), Rojo (Vencido).",
            "Para subir un nuevo documento: Seleccione entidad, tipo (SOAT, CITV, Tarjeta de Propiedad, Póliza), fecha de emisión, fecha de vencimiento y adjunte el PDF o foto.",
            "El sistema actualizará automáticamente el estado de la unidad.",
        ],
        [("Matriz de Documentos", "Listado consolidado con entidad, tipo, vigencia y archivo."), ("Alertas de Caducidad", "Contadores de documentos por vencer en 7, 15 y 30 días."), ("Subida Segura", "Almacenamiento privado protegido contra accesos públicos.")],
        "Se renueva el SOAT de la carreta B4T-982 en La Positiva: Se sube el PDF con vigencia del 29/08/2026 al 29/08/2027. El semáforo pasa a Verde y la carreta queda habilitada para circular.",
        "Los documentos cargados aquí están disponibles para que el chofer los descargue en su celular si un policía o inspector de SUTRAN se los solicita en carretera."
    )

    # 29. ALERTAS DEL SISTEMA
    screen_section_page(
        story, s, "29", "Panel de Alertas Operativas y Excepciones",
        "Centro de notificaciones inteligentes que avisa a Gerencia sobre problemas antes de que se conviertan en crisis.",
        "Evita tener que revisar pantalla por pantalla: reúne en una sola lista todo lo que requiere una decisión urgente del dueño.",
        ["Alertas Críticas (Rojas): Bloquean operaciones de salida hasta que sean resueltas o autorizadas por Gerencia."],
        [
            "Abra el módulo 'Alertas' desde el menú superior.",
            "Revise las alertas clasificadas por severidad: 'Crítica', 'Advertencia' e 'Informativa'.",
            "Tipos de alertas: Documento vencido, Mantenimiento pasado, Rendición estancada, Factura vencida, Desvío de odómetro GPS.",
            "Haga clic en 'Resolver' o en el enlace directo para ir a la pantalla del problema.",
        ],
        [("Bandeja de Alertas", "Lista de eventos anómalos ordenados por urgencia."), ("Filtro de Severidad", "Ver solo críticas o todas."), ("Acción Rápida", "Botón directo para solucionar o descartar la alerta con justificación.")],
        "El dueño ve 2 alertas: 1) 'Tracto V7B-840: Revisión Técnica vence en 5 días' (Amarilla), 2) 'Chofer Pedro: Rendición #078 lleva 4 días abierta con S/. 350 de saldo' (Roja). El dueño llama a administración para exigir la rendición.",
        "Nunca ignore una alerta roja. Si descarta una alerta sin resolver el problema de fondo, el sistema le pedirá escribir un motivo obligatorio que quedará registrado en auditoría."
    )

    # 30. REPORTES GERENCIALES
    screen_section_page(
        story, s, "30", "Reportes e Indicadores Gerenciales (KPIs)",
        "Tableros analíticos y gráficos ejecutivos que miden el rendimiento económico y operativo del negocio.",
        "Permite al dueño tomar decisiones estratégicas basadas en datos duros: qué camión produce más, qué ruta es más rentable y qué cliente deja mejor margen.",
        ["Tendencia de Costos: Si el gasto de combustible sube del 40% al 48% del flete total, revise hábitos de manejo o tarifas."],
        [
            "Seleccione el periodo de análisis: 'Este Mes', 'Último Trimestre' o rango personalizado de fechas.",
            "Consulte los reportes clave:",
            "  › 1. Rentabilidad Neta por Viaje y por Cliente.",
            "  › 2. Rendimiento de Combustible Promedio por Unidad (km/galón).",
            "  › 3. Utilización de Flota (% de días rodando vs días parados).",
            "  › 4. Antigüedad de Cuentas por Cobrar (Aging de deuda).",
        ],
        [("Selector de Periodos", "Filtros por mes, año o rango de fechas."), ("Gráficos de Rentabilidad", "Comparativos de ingresos vs egresos."), ("Tablas Detalladas", "Exportación de datos para análisis contable.")],
        "El dueño revisa el reporte mensual: Facturación total S/. 84,000, Costos directos S/. 42,500, Mantenimiento S/. 6,200. Utilidad Neta de la flota: S/. 35,300 (Margen neto: 42%). La ruta más rentable fue Lima–Marcona.",
        "Los reportes se calculan en tiempo real a partir de los datos registrados; no requieren consolidaciones manuales en Excel."
    )

    # 31. CONFIGURACIÓN: EMPRESA
    screen_section_page(
        story, s, "31", "Configuración de Empresa y Parámetros",
        "Ajustes generales de la empresa: Razón Social, RUC, logo, dirección, cuentas bancarias y parámetros económicos.",
        "Permite que todos los documentos emitidos (órdenes, liquidaciones, reportes) lleven la identidad oficial de R&T SITRAM SAC.",
        ["Datos bancarios: Mantenga actualizados los números de cuenta corriente y CCI para que los clientes paguen al lugar correcto."],
        [
            "Abra 'Configuración › Empresa' (exclusivo para Gerencia y Administración).",
            "Actualice Razón Social, RUC, Dirección fiscal y Teléfonos corporativos.",
            "Configure las Cuentas Bancarias de la empresa (BCP, BBVA, Banco de la Nación para detracciones).",
            "Ajuste los parámetros del cotizador (precio base del diésel, costo de peaje por eje).",
        ],
        [("Datos Corporativos", "RUC, Nombre oficial y Logotipo."), ("Cuentas Bancarias", "Cuentas en Soles, Dólares y Cuenta de Detracción SPOT."), ("Parámetros del Cotizador", "Valores económicos para el Evaluador de Viajes.")],
        "Se abre una nueva cuenta corriente en el BBVA: El dueño ingresa a Configuración y añade el nuevo número de cuenta y CCI. Al instante, las nuevas órdenes de cobranza muestran la cuenta actualizada.",
        "Si el precio nacional del diésel sube de S/. 16.50 a S/. 17.80, actualice el valor aquí para que las cotizaciones del Evaluador de Viajes calculen el margen con el precio real."
    )

    # 32. CONFIGURACIÓN: PERFILES Y ROLES
    screen_section_page(
        story, s, "32", "Gestión de Perfiles y Control de Accesos",
        "Control de usuarios del sistema: quién puede entrar, qué permisos tiene y qué pantallas puede ver.",
        "Garantiza que ningún empleado vea más de lo que debe: un chofer no puede ver facturación ni un administrativo puede borrar auditoría.",
        ["Bajas de personal: Desactive inmediatamente la cuenta de cualquier colaborador que deje de trabajar en la empresa."],
        [
            "Abra 'Configuración › Perfiles de Usuario'.",
            "Consulte la lista de usuarios activos con su rol asignado.",
            "Para invitar a un nuevo empleado: Haga clic en '+ Nuevo Usuario', ingrese su correo y seleccione su rol (Gerencia, Administración, Contabilidad o Conductor).",
            "Para bloquear a un usuario: Cambie su estado a 'Inactivo'.",
        ],
        [("Directorio de Usuarios", "Nombre, Correo, Rol, Último ingreso y Estado."), ("Asignación de Roles", "Permisos estrictos según función en la empresa."), ("Control de Estado", "Activar, suspender o restablecer clave.")],
        "Ingresa una nueva asistente contable: El dueño crea su usuario con el rol 'Contabilidad'. La asistente puede ver facturas, pagos y cobranza, pero no puede modificar asignaciones de camiones ni ver el módulo de GPS.",
        "Nunca asigne el rol 'Gerencia' a personal operativo; reserve este rol únicamente para los propietarios y directores generales de R&T SITRAM."
    )

    # 33. CONFIGURACIÓN: ODÓMETRO GPS
    screen_section_page(
        story, s, "33", "Calibración y Odómetro GPS (Goldcar / Wialon)",
        "Control de la telemetría satelital GPS para validar el kilometraje real recorrido por los camiones de forma automática.",
        "Detecta si un chofer alteró el kilometraje en su reporte manual o si el camión hizo viajes 'piratas' o desvíos no autorizados.",
        ["Desvíos de Odómetro (> 50 km): Si el GPS marca una distancia significativamente mayor a la ruta normal, investigue posibles desvíos."],
        [
            "Consulte la tabla de sincronización satelital con la plataforma GPS Goldcar/Wialon.",
            "Revise las lecturas de odómetro capturadas por satélite vs las reportadas por el conductor.",
            "Si una lectura GPS es dudosa (ej. salto de señal o túnel): Gerencia puede aprobarla o rechazarla con un clic.",
            "Establezca el 'Odómetro Oficial de la Unidad' con respaldo inmutable.",
        ],
        [("Conexión Satelital", "Estado de enlace con el servidor de rastreo GPS."), ("Comparativo Odómetros", "Lectura GPS vs Lectura Chofer vs Odómetro Oficial."), ("Bandeja de Anomalías", "Saltos de kilometraje que requieren aprobación de Gerencia.")],
        "Tracto V7B-840: El chofer reporta 485,200 km al llegar a Lima. La plataforma GPS reporta 485,215 km (diferencia mínima de 15 km por calibración de llantas). El sistema acepta la lectura como válida.",
        "La integración GPS funciona como fuente de evidencia auditada; ante cualquier inconsistencia satelital, Gerencia tiene la última palabra para fijar el odómetro oficial."
    )

    # 34. PWA CONDUCTOR: MI VIAJE
    screen_section_page(
        story, s, "34", "PWA Conductor — Pantalla 'Mi Viaje'",
        "La pantalla principal que ve el chofer en su teléfono celular al abrir la aplicación móvil de R&T SITRAM.",
        "Le da al conductor instrucciones claras de qué viaje tiene que hacer, qué carga lleva, a dónde va y qué botones usar en ruta.",
        ["Viaje sin iniciar: El chofer debe pulsar 'Iniciar Viaje' en el momento exacto en que enciende el camión para salir de base."],
        [
            "El chofer abre la app en su teléfono (funciona como aplicación instalada).",
            "Ve su misión activa: Origen, Destino, Cliente, Placa del Tracto y Carreta.",
            "Revisa los 4 botones de acción rápida: 'Combustible', 'Gasto', 'Kilometraje', 'Incidencia'.",
            "Al llegar a destino, pulsa 'Finalizar Etapa de Ruta'.",
        ],
        [("Tarjeta de Misión", "Ruta activa, Cliente, Carga y Placas asignadas."), ("Botones de Acción", "4 accesos rápidos grandes y fáciles de pulsar."), ("Estado de Conexión", "Indicador verde 'Sincronizado' o amarillo 'Modo Offline'.")],
        "El chofer Juan prende su celular en Lurín: Ve 'Viaje: Lurín › Pisco', 'Carga: 30 TN Varillas', 'Tracto: V7B-840'. Pulsa 'Iniciar Salida' y el sistema registra su hora de partida oficial.",
        "La app móvil está diseñada con botones grandes y texto claro para que el chofer pueda operarla fácilmente incluso con guantes o bajo el sol.",
        is_mobile=True
    )

    # 35. PWA CONDUCTOR: REGISTRAR COMBUSTIBLE
    screen_section_page(
        story, s, "35", "PWA Conductor — Registro de Combustible",
        "Formulario móvil ultra-rápido para que el chofer anote cada carga de diésel en el mismo momento en que está en el grifo.",
        "Evita que los choferes pierdan los vouchers del grifo o se olviden de cuánto diésel cargaron al final de la semana.",
        ["Foto obligatoria del voucher: Exija que la foto muestre claramente el número de galones y el total en Soles."],
        [
            "El chofer pulsa el botón 'Combustible' en su app.",
            "Ingresa: Nombre del Grifo (ej. Primax), Cantidad de Galones (ej. 45.5) y Monto Total en S/.",
            "Ingresa el Odómetro actual del tablero del camión.",
            "Selecciona si pagó con 'Efectivo/Yape de su fondo' o 'Vale/Crédito de la empresa'.",
            "Toma una foto al voucher del grifo con la cámara del celular.",
            "Pulsa 'Guardar'. El registro queda guardado en el teléfono y se enviará a la oficina.",
        ],
        [("Formulario Móvil Diésel", "Campos simples: Grifo, Galones, Total S/ y Odómetro."), ("Selector de Pago", "Diferenciar efectivo vs crédito."), ("Cámara Integrada", "Toma instantánea del comprobante del surtidor.")],
        "En Grifo Pecsa de Chincha, el chofer carga 50 galones de diésel (S/. 840). Abre la app, llena los 3 datos, le toma foto al ticket y pulsa Guardar en 20 segundos antes de volver a la pista.",
        "Si no hay señal de celular en el grifo, la app guarda la foto y los datos en la memoria interna del teléfono sin dar error y los sube sola al llegar a una zona con cobertura.",
        is_mobile=True
    )

    # 36. PWA CONDUCTOR: REGISTRAR GASTOS
    screen_section_page(
        story, s, "36", "PWA Conductor — Registro de Gastos de Ruta",
        "Formulario móvil para anotar peajes, cocheras, alimentos, estiba, pesajes y parches de llantas.",
        "Permite que cada sol gastado en carretera quede registrado al instante con su comprobante fotográfico.",
        ["Tickets térmicos de peaje: Las boletas de peaje se borran con el calor en pocos días; tomarles foto en la app garantiza su archivo eterno."],
        [
            "El chofer pulsa el botón 'Gasto' en su pantalla.",
            "Selecciona la Categoría: 'Peaje', 'Alimentación', 'Cochera / Guardería', 'Pesaje / Balanza', 'Estiba' u 'Otro'.",
            "Ingresa el Monto en Soles (ej. S/. 15.40).",
            "Toma foto al comprobante o ticket con la cámara.",
            "Pulsa 'Guardar Gasto'.",
        ],
        [("Categorías de Gasto", "Botones predefinidos para peajes, comidas y cocheras."), ("Monto y Descripción", "Campo numérico y nota breve opcional."), ("Captura de Foto", "Foto nítida del ticket.")],
        "El chofer pasa el Peaje de Chilca (S/. 15.40). Guarda el ticket, abre la app, selecciona 'Peaje', escribe '15.40', le toma foto y guarda. Al llegar a Pisco ya tiene todos sus peajes registrados.",
        "Si el chofer realiza un gasto que no tiene boleta formal (ej. propina de estibador para acomodar fardos), debe seleccionar 'Otro', anotar el motivo y el sistema lo marcará para revisión de la administradora.",
        is_mobile=True
    )

    # 37. PWA CONDUCTOR: REGISTRAR KILOMETRAJE
    screen_section_page(
        story, s, "37", "PWA Conductor — Registro de Odómetro / Kilometraje",
        "Herramienta de control para fotografiar el tablero del camión al salir, en puntos intermedios y al llegar a destino.",
        "Elimina las dudas sobre el kilometraje real del viaje y respalda la medición de desgaste de neumáticos.",
        ["Tablero apagado o borroso: La foto debe mostrar claramente los números del odómetro digital/análogo y el nivel de combustible."],
        [
            "El chofer pulsa 'Kilometraje' en su app.",
            "Escribe la lectura exacta de números que marca el tablero (ej. 485320).",
            "Toma una foto enfocando el tablero de instrumentos del camión.",
            "Indica el motivo: 'Salida de Base', 'Control en Ruta' o 'Llegada a Destino'.",
            "Pulsa 'Guardar Odómetro'.",
        ],
        [("Lectura Numérica", "Ingreso del kilometraje actual."), ("Evidencia de Tablero", "Foto directa del panel del camión."), ("Hito de Medición", "Momento en que se toma la lectura.")],
        "Al salir del almacén de Lurín, el chofer registra 'Odómetro: 485,000 km' con foto del tablero. Al llegar a Marcona registra 'Odómetro: 485,450 km'. La oficina comprueba que recorrió exactamente 450 km.",
        "Si el odómetro físico del camión se avería, el chofer debe reportar de inmediato una incidencia para que el sistema use el odómetro satelital del GPS como respaldo temporal.",
        is_mobile=True
    )

    # 38. PWA CONDUCTOR: REGISTRAR INCIDENCIA
    screen_section_page(
        story, s, "38", "PWA Conductor — Registro de Incidencias en Ruta",
        "Botón de alerta para reportar averías mecánicas, pinchazos, bloqueos de vía, accidentes o problemas con la carga.",
        "Avisa inmediatamente a la oficina sobre emergencias en carretera para enviar ayuda o coordinar con el cliente.",
        ["Seguridad ante todo: El chofer debe detener el camión en un lugar seguro antes de manipular el celular para reportar la incidencia."],
        [
            "El chofer pulsa el botón naranja 'Incidencia'.",
            "Selecciona el Tipo: 'Falla Mecánica', 'Pinchazo / Llanta', 'Bloqueo / Tráfico', 'Problema con la Carga', 'Intervención Policial / SUTRAN' u 'Otro'.",
            "Describe brevemente lo ocurrido (ej. 'Llanta trasera derecha reventada en km 180').",
            "Adjunta foto del problema si aplica.",
            "Pulsa 'Enviar Reporte'.",
        ],
        [("Tipo de Emergencia", "Clasificación rápida del problema."), ("Descripción", "Texto breve del suceso."), ("Evidencia Visual", "Foto de la llanta o situación en carretera.")],
        "En el km 140 de la Panamericana Sur se revienta una llanta. El chofer reporta 'Pinchazo' con foto. La oficina en Lima ve la alerta, autoriza el cambio con la llanta de repuesto y programa la compra de un neumático nuevo.",
        "Si la incidencia requiere dinero urgente (ej. pagar una grúa), el chofer lo indica en la descripción para que administración le haga una transferencia inmediata.",
        is_mobile=True
    )

    # 39. PWA CONDUCTOR: HISTORIAL LOCAL
    screen_section_page(
        story, s, "39", "PWA Conductor — Historial y Bitácora Local",
        "Consulta de todos los registros guardados en el teléfono durante el viaje actual y servicios anteriores.",
        "Le da tranquilidad al chofer de verificar qué gastos ya anotó y cuánto dinero lleva gastado sin tener que sumar papeles en la mano.",
        ["Revisión antes de rendir: El chofer puede ver su lista de gastos antes de entregar las cuentas a la administradora."],
        [
            "El chofer abre la pestaña 'Historial' en el menú inferior de la app.",
            "Revisa la lista de comprobantes, cargas de diésel y odómetros registrados en el día.",
            "Puede ver el icono de estado junto a cada registro: 'Guardado en Celular' (Reloj) o 'Sincronizado con Oficina' (Check Verde).",
        ],
        [("Lista de Actividades", "Cronología de todos los registros guardados."), ("Iconos de Estado", "Diferenciar lo que ya subió a la nube de lo que está en cola local.")],
        "El chofer quiere saber si ya anotó el peaje de Ica: Abre Historial, ve 'Peaje Ica S/. 15.40 - Sincronizado' y confirma que ya está registrado sin duplicarlo.",
        "Los registros guardados en el teléfono no se borran aunque el chofer cierre la aplicación o apague el celular.",
        is_mobile=True
    )

    # 40. PWA CONDUCTOR: SINCRONIZACIÓN OFFLINE
    screen_section_page(
        story, s, "40", "PWA Conductor — Centro de Sincronización (Modo Sin Internet)",
        "Motor tecnológico que permite a la aplicación trabajar en zonas desérticas o cerros sin ninguna señal de internet.",
        "Garantiza que la operación nunca se detenga: el chofer registra todo en su celular y el sistema sube los datos solos al volver la señal.",
        ["Cola de Envío: Si el chofer ve '3 elementos pendientes', solo debe esperar a llegar a una zona con cobertura 4G/WiFi."],
        [
            "Abra la pantalla 'Sincronización' desde el menú lateral.",
            "Consulte el estado general: 'En Línea' (Verde) o 'Trabajando Sin Conexión' (Amarillo).",
            "Revise la 'Cola de Subida': lista de fotos y registros que están esperando conexión para enviarse.",
            "Al recuperar señal, el sistema subirá los archivos automáticamente uno por uno.",
            "Si es necesario forzar el envío, pulse 'Sincronizar Ahora'.",
        ],
        [("Semáforo de Conexión", "Estado de red en tiempo real."), ("Cola de Transferencia", "Contador de registros pendientes de envío."), ("Botón Forzar Sincronización", "Reintento manual de subida.")],
        "El camión entra a una mina en la sierra sin señal por 8 horas. El chofer registra diésel, odómetro y 2 peajes normalmente. Al salir a la carretera asfaltada y captar señal 4G, la app sube todo a la oficina en 10 segundos.",
        "Si un chofer llega a la oficina y todavía tiene fotos pendientes de subir, conéctelo al WiFi de la base y pulse 'Sincronizar Ahora' antes de que apague el celular.",
        is_mobile=True
    )

    # =========================================================================
    # SECCIÓN ESPECIAL: CASOS PRÁCTICOS DE LA VIDA REAL (8 CASOS)
    # =========================================================================
    story.append(P("Guía de Casos Prácticos de la Vida Real", s["title"]))
    story.append(P("Paso a paso de cómo resolver las 8 situaciones más comunes en la operación diaria de R&T SITRAM SAC.", s["subtitle"]))

    real_cases = [
        (
            "Caso 1: Nuevo cliente solicita flete urgente Lima › Pisco",
            "1. Abra 'Evaluador de Viajes', ingrese Lima–Pisco y el flete ofrecido (ej. S/. 2,400). Verifique margen > 30%.<br/>"
            "2. Si es rentable, vaya a 'Viajes › + Nuevo Viaje', registre al cliente y los datos acordados.<br/>"
            "3. En 'Programación', asigne el tracto libre (ej. V7B-840) y al chofer disponible.<br/>"
            "4. Transfiera S/. 400 de anticipo para peajes/viáticos y regístrelo en 'Adelantos'.<br/>"
            "5. El chofer recibe la notificación en su celular y sale a cargar."
        ),
        (
            "Caso 2: El chofer pide S/. 450 de adelanto para peajes y viáticos",
            "1. Administración realiza la transferencia bancaria o Yape a la cuenta del chofer.<br/>"
            "2. Abre el viaje en el sistema, va a la pestaña 'Dinero › + Nuevo Adelanto'.<br/>"
            "3. Escribe 'S/. 450.00', selecciona 'Transferencia BCP' y anota el número de operación.<br/>"
            "4. El dinero queda cargado a la cuenta del chofer como 'Fondo a Rendir' para ese viaje."
        ),
        (
            "Caso 3: El camión abastece S/. 700 de diésel con factura a crédito en grifo autorizado",
            "1. El chofer llena el tanque en el grifo con el vale de la empresa.<br/>"
            "2. En su app móvil pulsa 'Combustible', ingresa los galones y el total S/. 700.<br/>"
            "3. Marca la opción 'Crédito de Empresa' (no efectivo propio) y toma foto al ticket.<br/>"
            "4. En la oficina, el gasto se suma al costo del viaje pero NO se le descuenta al chofer en su rendición."
        ),
        (
            "Caso 4: Se pincha un neumático en la Panamericana Sur y no hay señal de celular",
            "1. El chofer se estaciona seguro y cambia la llanta por el repuesto.<br/>"
            "2. Abre su app móvil (que funciona sin internet) y pulsa 'Incidencia › Pinchazo'. Anota el km y toma foto.<br/>"
            "3. Si paga S/. 35 a un llantero en efectivo, pulsa 'Gasto › Reparación S/. 35' y le toma foto al recibo.<br/>"
            "4. Al volver a tener señal, la app envía la incidencia y el gasto automáticamente a la oficina."
        ),
        (
            "Caso 5: La unidad regresa y el chofer rinde cuentas con saldo a devolver de S/. 65",
            "1. Administración abre 'Finanzas › Rendiciones' y selecciona el viaje del chofer.<br/>"
            "2. Revisa y aprueba los gastos y peajes justificados con foto (Total gastos: S/. 385 vs Anticipo: S/. 450).<br/>"
            "3. El sistema muestra: 'Saldo a favor de Empresa: S/. 65.00'.<br/>"
            "4. El chofer devuelve los S/. 65 por Yape o efectivo. Administración registra 'Yape Op: 4892' y pulsa 'Cerrar Rendición'."
        ),
        (
            "Caso 6: El odómetro del chofer difiere de la lectura reportada por el GPS",
            "1. El sistema genera una alerta amarilla en 'Odómetro GPS' por discrepancia de 28 km.<br/>"
            "2. Gerencia abre el comparativo y revisa la foto del tablero enviada por el chofer y el mapa satelital.<br/>"
            "3. Se comprueba que el chofer dio una vuelta adicional autorizada para dejar un paquete.<br/>"
            "4. Gerencia aprueba la lectura en el sistema con la nota justificativa y se fija el nuevo odómetro oficial."
        ),
        (
            "Caso 7: Emisión de factura con pago a 30 días y cobro con detracción",
            "1. Al tener la foto de la Guía sellada en el viaje, Contabilidad emite la factura electrónica por S/. 2,950 (con IGV).<br/>"
            "2. En 'Cobranza', registra la factura vinculada al viaje con vencimiento a 30 días.<br/>"
            "3. A los 30 días, el cliente paga S/. 2,832 (96%) a cuenta corriente y S/. 118 (4%) a la cuenta de detracciones SPOT.<br/>"
            "4. Contabilidad registra ambos depósitos y el viaje queda marcado como '100% Cobrado'."
        ),
        (
            "Caso 8: Mantenimiento correctivo de frenos en taller externo con repuestos propios",
            "1. El chofer reporta ruido en frenos. Administración abre 'Mantenimiento › + Nueva Orden de Trabajo'.<br/>"
            "2. Se marca la unidad como 'Bloqueada en Taller' y se envía al taller externo de confianza.<br/>"
            "3. R&T compra las pastillas en tienda de repuestos (S/. 320) y paga mano de obra al taller (S/. 150).<br/>"
            "4. En la orden de trabajo se registran ambas facturas, fotos de los frenos nuevos y se cierra la orden para liberar el camión."
        ),
    ]

    for title_case, steps_case in real_cases:
        story.append(callout_box(s, title_case, steps_case, bg_color=WHITE, border_color=BLUE, title_style="label_blue"))
        story.append(Spacer(1, 4))

    story.append(PageBreak())

    # =========================================================================
    # RUTINA RECOMENDADA DEL PROPIETARIO / GERENCIA (CHECKLIST)
    # =========================================================================
    story.append(P("Rutina Gerencial del Propietario", s["title"]))
    story.append(P("Cómo controlar toda la empresa en menos de 20 minutos al día usando el Centro de Control Digital.", s["subtitle"]))

    routine_data = [
        [P("MOMENTO", s["label_white"]), P("PANTALLAS A REVISAR", s["label_white"]), P("ACCIÓN / DECISIÓN ESPERADA DEL DUEÑO", s["label_white"])],
        [
            P("<b>AL EMPEZAR EL DÍA<br/>(8:00 AM — 5 min)</b>", s["label"]),
            P("1. Dashboard de Inicio.<br/>2. Alertas Críticas.<br/>3. Flota Disponible vs En Ruta.", s["body_small"]),
            P("• Verificar que los viajes programados salieron a tiempo.<br/>• Resolver alertas rojas de documentos o camiones parados.<br/>• Confirmar qué camiones están libres para aceptar cargas nuevas.", s["body_small"]),
        ],
        [
            P("<b>DURANTE EL DÍA<br/>(En cualquier momento)</b>", s["label"]),
            P("1. Evaluador de Viajes.<br/>2. Pestaña Dinero de viajes.", s["body_small"]),
            P("• Cotizar fletes nuevos verificando margen de rentabilidad.<br/>• Autorizar adelantos de viaje solicitados por choferes.", s["body_small"]),
        ],
        [
            P("<b>AL FINAL DEL DÍA<br/>(6:00 PM — 5 min)</b>", s["label"]),
            P("1. Rendiciones de Cuentas.<br/>2. Documentos y Guías selladas.", s["body_small"]),
            P("• Exigir liquidación y devolución de vueltos a choferes que retornaron.<br/>• Verificar que las guías de los viajes completados estén subidas para facturar.", s["body_small"]),
        ],
        [
            P("<b>LOS LUNES POR LA MAÑANA<br/>(Semanal — 10 min)</b>", s["label"]),
            P("1. Cobranza y Cuentas por Cobrar.<br/>2. Mantenimiento Preventivo.<br/>3. Reportes del Mes.", s["body_small"]),
            P("• Llamar a clientes con facturas por vencer o vencidas.<br/>• Agendar ingresos a taller de camiones que están por cumplir kilometraje.<br/>• Revisar la utilidad neta acumulada de la flota.", s["body_small"]),
        ],
    ]
    routine_table = Table(routine_data, colWidths=[1.8 * inch, 2.3 * inch, 2.7 * inch])
    routine_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(routine_table)
    story.append(Spacer(1, 10))

    story.append(callout_box(
        s,
        "MENSAJE FINAL PARA LA DIRECCIÓN",
        "El Centro de Control Digital de R&T SITRAM SAC no busca cambiar la forma exitosa en que usted hace negocios. Su propósito es <b>proteger su esfuerzo, blindar su dinero contra fugas y darle a usted la tranquilidad y el control total de su empresa en la palma de su mano</b>.<br/><br/>"
        "<i>«La información en orden es rentabilidad asegurada y tranquilidad para crecer.»</i>",
        bg_color=PALE_GREEN, border_color=GREEN_ACCENT, title_style="label_green"
    ))

    # Compilación final del documento
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF generado con éxito en: {OUTPUT}")


if __name__ == "__main__":
    generate_manual_pdf()
