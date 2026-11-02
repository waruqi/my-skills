"""校验连续讲解的顺序、图、动画范围和源码片段。"""


def validate_lesson(content, pages):
    lesson = content.get('lesson')
    if lesson is None:
        return
    if not isinstance(lesson, dict) or not isinstance(lesson.get('slides'), list) or not lesson['slides']:
        raise ValueError('lesson.slides 不能为空')
    diagrams = {d['id']: d for d in content['diagrams']}
    for slide in lesson['slides']:
        if not isinstance(slide, dict) or slide.get('page') not in pages:
            raise ValueError('讲解引用了不存在的页面')
        for field in ('title','chapter','note'):
            if not isinstance(slide.get(field), str) or not slide[field].strip():
                raise ValueError(f'讲解缺少 {field}')
        page = pages[slide['page']]
        if slide.get('diagram'):
            diagram = diagrams.get(slide['diagram'])
            if not diagram or page['id'] not in diagram['pages']:
                raise ValueError('讲解图不属于所选页面')
        if 'steps' in slide:
            bounds = slide['steps']
            flow = page.get('walkthrough')
            if not flow or not isinstance(bounds,list) or len(bounds)!=2 or any(type(i) is not int for i in bounds) or not 0 <= bounds[0] <= bounds[1] < len(flow['steps']):
                raise ValueError('讲解动画步骤范围无效')
            if slide.get('diagram',flow['diagram']) != flow['diagram']:
                raise ValueError('讲解图必须与动画图一致')
