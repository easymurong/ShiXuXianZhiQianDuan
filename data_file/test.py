import requests

# 目标 URL
url = "http://222.201.56.78:5000/api/devices/1/realtime"

try:
    # 发送 GET 请求
    response = requests.get(url)
    
    # 检查 HTTP 状态码
    if response.status_code == 200:
        # 解析 JSON 数据为 Python 字典
        data = response.json()
        
        # 打印获取的数据（可根据需要处理）
        print("成功获取数据：")
        print(data)
        
        # 示例：访问具体字段（假设返回数据包含 temperature 和 humidity）
        # temperature = data.get('temperature')
        # humidity = data.get('humidity')
        # print(f"温度: {temperature}, 湿度: {humidity}")
        
    else:
        print(f"请求失败，状态码：{response.status_code}")
        print("响应内容：", response.text)

except requests.exceptions.RequestException as e:
    # 处理网络异常（如连接失败、超时等）
    print(f"网络请求异常：{e}")